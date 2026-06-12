import { requestUrl, base64ToArrayBuffer } from 'obsidian';

const API_BASE = 'https://api.weixin.qq.com/cgi-bin';

export interface DraftArticle {
  title: string;
  author: string;
  digest: string;
  content: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

export class WechatApiError extends Error {
  constructor(public errcode: number, public errmsg: string, public step: string) {
    super(`[${step}] errcode=${errcode} ${errmsg}`);
  }
}

/** 把微信错误码翻译成可操作的中文提示 */
export function describeWechatError(err: unknown): string {
  if (err instanceof WechatApiError) {
    switch (err.errcode) {
      case 40001:
      case 40013:
      case 41002:
      case 41004:
        return 'AppID 或 AppSecret 不正确，请在插件设置中检查。';
      case 40164:
        return '当前 IP 不在公众号白名单中。请登录微信公众平台 → 设置与开发 → 基本配置 → IP 白名单，添加本机出口 IP。';
      case 45009:
        return '接口调用次数超限，请明天再试或在公众平台清空配额。';
      case 48001:
        return '该公众号没有此接口权限（草稿箱/素材接口需要认证的公众号）。';
      case 45110:
        return '作者字段过长（最多 8 个汉字 / 16 个字符）。';
      default:
        return `微信接口返回错误（${err.step}）：${err.errcode} ${err.errmsg}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

function parseJson(text: string, step: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    throw new WechatApiError(-1, `非 JSON 响应：${text.slice(0, 200)}`, step);
  }
}

function assertOk(json: Record<string, unknown>, step: string): void {
  const code = Number(json.errcode ?? 0);
  if (code !== 0) {
    throw new WechatApiError(code, String(json.errmsg ?? 'unknown error'), step);
  }
}

function buildMultipart(
  fieldName: string,
  filename: string,
  mime: string,
  data: ArrayBuffer
): { contentType: string; body: ArrayBuffer } {
  const boundary = '----MarkNiceWechat' + Date.now().toString(16) + Math.random().toString(16).slice(2);
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const payload = new Uint8Array(head.byteLength + data.byteLength + tail.byteLength);
  payload.set(head, 0);
  payload.set(new Uint8Array(data), head.byteLength);
  payload.set(tail, head.byteLength + data.byteLength);
  return { contentType: `multipart/form-data; boundary=${boundary}`, body: payload.buffer };
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

export class WechatClient {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private appId: string, private appSecret: string) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 5 * 60 * 1000) {
      return this.cachedToken.token;
    }
    const url = `${API_BASE}/token?grant_type=client_credential&appid=${encodeURIComponent(
      this.appId
    )}&secret=${encodeURIComponent(this.appSecret)}`;
    const res = await requestUrl({ url, throw: false });
    const json = parseJson(res.text, '获取 access_token');
    assertOk(json, '获取 access_token');
    const token = String(json.access_token);
    this.cachedToken = { token, expiresAt: Date.now() + Number(json.expires_in ?? 7200) * 1000 };
    return token;
  }

  /** 上传封面（永久素材），返回 thumb_media_id */
  async uploadThumb(data: ArrayBuffer, filename: string, mime: string): Promise<string> {
    const token = await this.getAccessToken();
    const { contentType, body } = buildMultipart('media', filename, mime, data);
    const res = await requestUrl({
      url: `${API_BASE}/material/add_material?access_token=${encodeURIComponent(token)}&type=image`,
      method: 'POST',
      contentType,
      body,
      throw: false,
    });
    const json = parseJson(res.text, '上传封面');
    assertOk(json, '上传封面');
    return String(json.media_id);
  }

  /** 上传正文图片，返回微信图片 URL（mmbiz.qpic.cn） */
  async uploadContentImage(data: ArrayBuffer, filename: string, mime: string): Promise<string> {
    const token = await this.getAccessToken();
    const { contentType, body } = buildMultipart('media', filename, mime, data);
    const res = await requestUrl({
      url: `${API_BASE}/media/uploadimg?access_token=${encodeURIComponent(token)}`,
      method: 'POST',
      contentType,
      body,
      throw: false,
    });
    const json = parseJson(res.text, '上传正文图片');
    assertOk(json, '上传正文图片');
    return String(json.url);
  }

  /** 创建草稿，返回草稿 media_id */
  async addDraft(article: DraftArticle): Promise<string> {
    const token = await this.getAccessToken();
    const res = await requestUrl({
      url: `${API_BASE}/draft/add?access_token=${encodeURIComponent(token)}`,
      method: 'POST',
      contentType: 'application/json',
      // 公众号接口要求 JSON 中的中文不被转义为 \uXXXX 之外的形式均可，JSON.stringify 默认即可
      body: JSON.stringify({ articles: [article] }),
      throw: false,
    });
    const json = parseJson(res.text, '创建草稿');
    assertOk(json, '创建草稿');
    return String(json.media_id);
  }

  /**
   * 把正文 HTML 中的图片全部替换为微信图床 URL。
   * 支持 data: 内联图与 http(s) 外链图；已在微信图床上的图片跳过。
   */
  async rewriteContentImages(
    html: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<string> {
    const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    const srcs = new Set<string>();
    for (const match of html.matchAll(imgRegex)) {
      const src = match[1];
      if (!src) continue;
      if (src.includes('mmbiz.qpic.cn') || src.includes('mmbiz.qlogo.cn')) continue;
      srcs.add(src);
    }
    if (!srcs.size) return html;

    let rewritten = html;
    let done = 0;
    let index = 0;
    for (const src of srcs) {
      index++;
      let data: ArrayBuffer | null = null;
      let mime = 'image/jpeg';

      if (src.startsWith('data:image/')) {
        const m = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
        if (m) {
          mime = m[1];
          data = base64ToArrayBuffer(m[2]);
        }
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        const res = await requestUrl({ url: src, throw: false });
        if (res.status >= 200 && res.status < 300) {
          data = res.arrayBuffer;
          mime = res.headers['content-type']?.split(';')[0] ?? 'image/jpeg';
        }
      }

      if (data) {
        const url = await this.uploadContentImage(data, `article-img-${index}.${extFromMime(mime)}`, mime);
        rewritten = rewritten.split(src).join(url);
      }
      done++;
      onProgress?.(done, srcs.size);
    }
    return rewritten;
  }
}
