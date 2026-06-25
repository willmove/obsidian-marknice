import { Notice, requestUrl } from 'obsidian';

export const DEFAULT_PADDLE_OCR_JOB_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs';
export const DEFAULT_PADDLE_OCR_MODEL = 'PaddleOCR-VL-1.6';

export interface PaddleOcrOptions {
  jobUrl: string;
  token: string;
  model: string;
  useDocOrientationClassify: boolean;
  useDocUnwarping: boolean;
  useChartRecognition: boolean;
}

interface JobCreateResponse {
  data?: {
    jobId?: string;
  };
  errorMsg?: string;
  message?: string;
}

type PaddleJobState = 'pending' | 'running' | 'done' | 'failed';

interface JobStatusResponse {
  data?: {
    state?: PaddleJobState;
    errorMsg?: string;
    extractProgress?: {
      totalPages?: number;
      extractedPages?: number;
      startTime?: string;
      endTime?: string;
    };
    resultUrl?: {
      jsonUrl?: string;
    };
  };
  errorMsg?: string;
  message?: string;
}

interface MarkdownResult {
  text?: string;
  images?: Record<string, string>;
}

interface LayoutParsingResult {
  markdown?: MarkdownResult;
  outputImages?: Record<string, string>;
}

interface JsonlPageResult {
  result?: {
    layoutParsingResults?: LayoutParsingResult[];
  };
}

export interface PaddleOcrMarkdownResult {
  markdown: string;
  images: Record<string, ArrayBuffer>;
}

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 10 * 60 * 1000;

function bearer(token: string): string {
  return token.trim().toLowerCase().startsWith('bearer ') ? token.trim() : `bearer ${token.trim()}`;
}

function parseJsonObject<T>(text: string, step: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${step} 返回了非 JSON 响应：${text.slice(0, 200)}`);
  }
}

function getResponseError(text: string): string {
  try {
    const json = JSON.parse(text) as { errorMsg?: string; message?: string };
    return json.errorMsg || json.message || text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

function buildMultipart(
  fields: Record<string, string>,
  fileField: string,
  filename: string,
  mime: string,
  data: ArrayBuffer
): { contentType: string; body: ArrayBuffer } {
  const boundary = '----MarkNicePaddleOcr' + Date.now().toString(16) + Math.random().toString(16).slice(2);
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
    );
  }

  chunks.push(
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    )
  );
  chunks.push(new Uint8Array(data));
  chunks.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { contentType: `multipart/form-data; boundary=${boundary}`, body: body.buffer };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function safeRelativeImagePath(path: string, fallback: string): string {
  const clean = path
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
  return clean || fallback;
}

function extFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

function decodeBase64Image(value: string): ArrayBuffer | null {
  const match = value.match(/^data:[^;]+;base64,([\s\S]+)$/i);
  const raw = match ? match[1] : value;
  if (/^https?:\/\//i.test(raw)) return null;

  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return null;
  }
}

async function imageToArrayBuffer(value: string): Promise<ArrayBuffer> {
  if (/^https?:\/\//i.test(value)) {
    const res = await requestUrl({ url: value, throw: false });
    if (res.status < 200 || res.status >= 300) throw new Error(`下载图片失败：HTTP ${res.status}`);
    return res.arrayBuffer;
  }

  const decoded = decodeBase64Image(value);
  if (!decoded) throw new Error('无法解析 OCR 返回的图片数据');
  return decoded;
}

async function submitJob(file: File, options: PaddleOcrOptions): Promise<string> {
  const optionalPayload = {
    useDocOrientationClassify: options.useDocOrientationClassify,
    useDocUnwarping: options.useDocUnwarping,
    useChartRecognition: options.useChartRecognition,
  };
  const { contentType, body } = buildMultipart(
    {
      model: options.model || DEFAULT_PADDLE_OCR_MODEL,
      optionalPayload: JSON.stringify(optionalPayload),
    },
    'file',
    file.name,
    file.type || 'application/pdf',
    await file.arrayBuffer()
  );

  const res = await requestUrl({
    url: options.jobUrl || DEFAULT_PADDLE_OCR_JOB_URL,
    method: 'POST',
    headers: { Authorization: bearer(options.token) },
    contentType,
    body,
    throw: false,
  });

  if (res.status !== 200) throw new Error(`提交 OCR 任务失败：HTTP ${res.status}，${getResponseError(res.text)}`);
  const json = parseJsonObject<JobCreateResponse>(res.text, '提交 OCR 任务');
  const jobId = json.data?.jobId;
  if (!jobId) throw new Error(json.errorMsg || json.message || 'OCR 服务未返回 jobId');
  return jobId;
}

async function waitForJsonlUrl(options: PaddleOcrOptions, jobId: string): Promise<string> {
  const startedAt = Date.now();
  let lastProgress = '';

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const res = await requestUrl({
      url: `${(options.jobUrl || DEFAULT_PADDLE_OCR_JOB_URL).replace(/\/$/, '')}/${encodeURIComponent(jobId)}`,
      method: 'GET',
      headers: { Authorization: bearer(options.token) },
      throw: false,
    });

    if (res.status !== 200) throw new Error(`查询 OCR 任务失败：HTTP ${res.status}，${getResponseError(res.text)}`);
    const json = parseJsonObject<JobStatusResponse>(res.text, '查询 OCR 任务');
    const data = json.data;
    const state = data?.state;

    if (state === 'done') {
      const url = data?.resultUrl?.jsonUrl;
      if (!url) throw new Error('OCR 任务完成，但服务未返回 jsonUrl');
      return url;
    }
    if (state === 'failed') throw new Error(data?.errorMsg || json.errorMsg || json.message || 'OCR 任务失败');

    const progress = data?.extractProgress;
    if (progress?.totalPages && progress.extractedPages !== undefined) {
      const nextProgress = `${progress.extractedPages}/${progress.totalPages}`;
      if (nextProgress !== lastProgress) {
        lastProgress = nextProgress;
        new Notice(`OCR 解析中：${nextProgress} 页`);
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('OCR 任务等待超时，请稍后重试');
}

async function downloadJsonl(jsonlUrl: string): Promise<string> {
  const res = await requestUrl({ url: jsonlUrl, throw: false });
  if (res.status < 200 || res.status >= 300) throw new Error(`下载 OCR 结果失败：HTTP ${res.status}`);
  return res.text;
}

export async function pdfToMarkdownWithPaddleOcr(file: File, options: PaddleOcrOptions): Promise<PaddleOcrMarkdownResult> {
  if (!options.token.trim()) throw new Error('请先在插件设置中填写 PaddleOCR Token');

  const jobId = await submitJob(file, options);
  new Notice(`OCR 任务已提交：${jobId}`);
  const jsonlUrl = await waitForJsonlUrl(options, jobId);
  const jsonl = await downloadJsonl(jsonlUrl);
  const markdownParts: string[] = [];
  const images: Record<string, ArrayBuffer> = {};
  let pageNum = 0;

  for (const rawLine of jsonl.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const page = parseJsonObject<JsonlPageResult>(line, `解析 OCR 结果第 ${pageNum + 1} 页`);
    const results = page.result?.layoutParsingResults ?? [];
    for (const result of results) {
      const md = result.markdown?.text?.trim();
      if (md) markdownParts.push(md);

      const mdImages = result.markdown?.images ?? {};
      for (const [path, value] of Object.entries(mdImages)) {
        const safePath = safeRelativeImagePath(path, `page-${pageNum + 1}.jpg`);
        try {
          images[safePath] = await imageToArrayBuffer(value);
        } catch (err) {
          console.warn('[MarkNice WeChat] download OCR markdown image failed', path, err);
        }
      }

      pageNum++;
    }
  }

  if (!markdownParts.length) throw new Error('OCR 完成，但结果中没有 Markdown 文本');
  return { markdown: markdownParts.join('\n\n---\n\n'), images };
}

