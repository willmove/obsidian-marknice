import { App, TFile, arrayBufferToBase64 } from 'obsidian';
import { marked } from 'marked';
import { WechatTheme } from './themes';

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];

export interface ConvertOptions {
  theme: WechatTheme;
  /** 是否把标题作为 H1 放进正文（公众号标题是单独字段，默认不放） */
  includeTitleInBody: boolean;
  /** 字号偏移（px），正负皆可 */
  fontSizeOffset?: number;
  /** 段距偏移（px），调整块级元素上下外边距 */
  paraSpacingOffset?: number;
}

export interface ConvertResult {
  /** 内联样式的 HTML 片段，可直接粘贴 / 提交给草稿接口 */
  html: string;
  /** 纯文本，用于剪贴板 text/plain 与摘要 */
  plainText: string;
  title: string;
  /** frontmatter 元信息 */
  meta: { title?: string; author?: string; digest?: string; cover?: string };
  /** 文中第一张图（库内路径或远程 URL），用作默认封面 */
  firstImage: { vaultPath?: string; url?: string } | null;
}

export function mimeFromExtension(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '');
  if (e === 'png') return 'image/png';
  if (e === 'gif') return 'image/gif';
  if (e === 'webp') return 'image/webp';
  if (e === 'bmp') return 'image/bmp';
  if (e === 'svg') return 'image/svg+xml';
  return 'image/jpeg';
}

function escapeHtml(str = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

const VAULT_SCHEME = 'mn-vault://';

/** Obsidian 专有语法 → 标准 Markdown / HTML 占位 */
function preprocessObsidianSyntax(app: App, markdown: string, sourcePath: string): string {
  let md = markdown;

  // ![[image.png|caption]] 图片嵌入
  md = md.replace(/!\[\[([^\]]+?)\]\]/g, (_match, inner: string) => {
    const [target, alias] = String(inner).split('|');
    const file = app.metadataCache.getFirstLinkpathDest(target.trim(), sourcePath);
    if (file && IMAGE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      return `![${(alias ?? '').trim()}](${VAULT_SCHEME}${encodeURIComponent(file.path)})`;
    }
    // 非图片嵌入（笔记嵌入等）公众号无法表达，降级为链接文字
    return (alias ?? target).trim();
  });

  // [[note|text]] 双链 → 纯文本
  md = md.replace(/(?<!!)\[\[([^\]]+?)\]\]/g, (_match, inner: string) => {
    const [target, alias] = String(inner).split('|');
    return (alias ?? target).trim();
  });

  // ==highlight== → <mark>
  md = md.replace(/==([^=\n][^=\n]*?)==/g, '<mark>$1</mark>');

  return md;
}

function setStyle(el: Element, style: string): void {
  el.setAttribute('style', style);
}

/**
 * 把 HTML 字符串解析为节点，返回 DocumentFragment。
 * 替代直接 innerHTML/outerHTML 赋值，满足 Obsidian 审核的
 * no-unsafe-innerhtml / no-unsafe-outerhtml 规则。
 * HTML 片段均为插件自身生成，不存在外部注入。
 */
function htmlToNodes(html: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const fragment = document.createDocumentFragment();
  while (doc.body.firstChild) {
    fragment.appendChild(doc.body.firstChild);
  }
  return fragment;
}

/** 用解析出的节点替换目标元素自身（替代 el.outerHTML = html） */
function replaceWithHtml(el: Element, html: string): void {
  el.replaceWith(htmlToNodes(html));
}

/** 用解析出的节点替换目标元素的子节点（替代 el.innerHTML = html） */
function setChildrenFromHtml(el: Element, html: string): void {
  el.replaceChildren(htmlToNodes(html));
}

/** 按偏移量缩放样式串中的 font-size 与上下 margin（与 Web 版 scaledStyle 同思路） */
function scaleStyle(style: string, fontOffset: number, spacingOffset: number): string {
  let s = style;
  if (fontOffset) {
    s = s.replace(/font-size:(\d+)px/g, (_m, n: string) => `font-size:${Math.max(Number(n) + fontOffset, 9)}px`);
  }
  if (spacingOffset) {
    // 三值形式 margin:Tpx X Bpx
    s = s.replace(/margin:(\d+)px ([^ ;]+) (\d+)px/g, (_m, t: string, mid: string, b: string) =>
      `margin:${Math.max(Number(t) + spacingOffset, 0)}px ${mid} ${Math.max(Number(b) + spacingOffset, 0)}px`
    );
    // 两值形式 margin:Tpx X（上下相同）
    s = s.replace(/margin:(\d+)px ([^ ;]+)(?=;|$)/g, (_m, t: string, mid: string) =>
      `margin:${Math.max(Number(t) + spacingOffset, 0)}px ${mid}`
    );
  }
  return s;
}

/**
 * 把 marked 输出的通用 HTML 转成微信编辑器安全的内联样式 HTML。
 * 公众号编辑器会丢弃 <style> 与 class，因此所有视觉信息必须落在 style 属性上。
 */
function applyThemeStyles(body: HTMLElement, theme: WechatTheme, fontOffset = 0, spacingOffset = 0): void {
  const strongColor = theme.strong ?? theme.heading;
  const codeText = theme.codeText ?? theme.text;
  const st = (css: string): string => scaleStyle(css, fontOffset, spacingOffset);

  body.querySelectorAll('script,style,link,meta,iframe').forEach((el) => el.remove());

  // Obsidian callout：blockquote 首段以 [!type] 开头，标题行加粗、正文换行
  body.querySelectorAll('blockquote > p:first-child').forEach((p) => {
    if (!/^\s*\[!\w+\][+-]?/.test(p.textContent ?? '')) return;
    const stripped = p.innerHTML.replace(/^\s*\[!\w+\][+-]?\s*/i, '');
    const split = stripped.match(/^([^\n]*?)(?:<br\s*\/?>|\n)([\s\S]*)$/i);
    if (split && split[1].trim()) {
      setChildrenFromHtml(p, `<strong>${split[1].trim()}</strong><br>${split[2]}`);
    } else if (stripped.trim() || p.querySelector('img')) {
      setChildrenFromHtml(p, `<strong>${stripped.trim()}</strong>`);
    } else {
      p.remove();
    }
  });

  body.querySelectorAll('p').forEach((p) => {
    setStyle(
      p,
      st(`margin:16px 0;line-height:1.9;color:${theme.text};font-size:16px;word-break:break-word;text-align:justify;`)
    );
  });

  body.querySelectorAll('h1').forEach((el) => {
    setStyle(
      el,
      st(`margin:28px 0 18px;padding-left:12px;border-left:4px solid ${theme.accent};font-size:24px;line-height:1.4;color:${theme.heading};font-weight:700;`)
    );
  });
  body.querySelectorAll('h2').forEach((el) => {
    setStyle(
      el,
      st(`margin:24px 0 14px;padding-left:10px;border-left:4px solid ${theme.accent};font-size:21px;line-height:1.45;color:${theme.heading};font-weight:700;`)
    );
  });
  body.querySelectorAll('h3').forEach((el) => {
    setStyle(el, st(`margin:20px 0 12px;font-size:18px;line-height:1.5;color:${theme.heading};font-weight:700;`));
  });
  body.querySelectorAll('h4,h5,h6').forEach((el) => {
    setStyle(el, st(`margin:18px 0 10px;font-size:17px;line-height:1.6;color:${theme.heading};font-weight:600;`));
  });

  body.querySelectorAll('blockquote').forEach((el) => {
    setStyle(
      el,
      st(`margin:18px 0;padding:12px 16px;background:${theme.quoteBg};border-left:4px solid ${theme.quoteBorder};color:${theme.text};border-radius:6px;`)
    );
  });

  // 任务列表：checkbox 在公众号里会被剥掉，换成符号
  body.querySelectorAll('li > input[type="checkbox"]').forEach((input) => {
    const symbol = body.ownerDocument.createElement('span');
    symbol.textContent = (input as HTMLInputElement).checked ? '✅ ' : '⬜ ';
    input.replaceWith(symbol);
  });

  body.querySelectorAll('ul,ol').forEach((el) => {
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 && !(node.textContent ?? '').trim()) node.remove();
    }
    el.querySelectorAll(':scope > li > p').forEach((p) => {
      p.replaceWith(htmlToNodes(p.innerHTML));
    });
    setStyle(el, st(`margin:14px 0 14px 1.2em;padding:0;color:${theme.text};line-height:1.9;`));
  });
  body.querySelectorAll('li').forEach((el) => {
    const text = (el.textContent ?? '').replace(/ /g, ' ').trim();
    if (!text && !el.querySelector('img,table,pre,code,blockquote,ul,ol')) {
      el.remove();
      return;
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 && !(node.textContent ?? '').trim()) node.remove();
    }
    setStyle(el, st(`margin:6px 0;font-size:16px;`));
  });

  body.querySelectorAll('pre').forEach((el) => {
    const code = (el.textContent ?? '').replace(/\n+$/, '');
    // 公众号编辑器会丢弃 white-space:pre-wrap，导致换行被折叠。
    // 因此显式把换行转成 <br>、空格转成 &nbsp; 以保留代码格式。
    const codeHtml = escapeHtml(code)
      .replace(/\t/g, '    ')
      .replace(/\n/g, '<br>')
      .replace(/ /g, '&nbsp;');
    replaceWithHtml(
      el,
      `<pre style="${st(
        `margin:18px 0;padding:14px 16px;overflow:auto;background:${theme.codeBg};border-radius:8px;color:${codeText};font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.7;white-space:normal;word-break:break-all;`
      )}">${codeHtml}</pre>`
    );
  });

  body.querySelectorAll('code').forEach((el) => {
    if (el.parentElement?.tagName.toLowerCase() === 'pre') return;
    replaceWithHtml(
      el,
      `<code style="font-family:Menlo,Consolas,monospace;background:${theme.codeBg};color:${
        theme.accent
      };padding:2px 6px;border-radius:4px;font-size:0.92em;">${escapeHtml(el.textContent ?? '')}</code>`
    );
  });

  body.querySelectorAll('strong,b').forEach((el) => {
    setStyle(el, `color:${strongColor};font-weight:700;`);
  });
  body.querySelectorAll('em,i').forEach((el) => {
    setStyle(el, `font-style:italic;`);
  });
  body.querySelectorAll('mark').forEach((el) => {
    setStyle(el, `background:${theme.markBg ?? theme.quoteBg};color:${theme.heading};padding:1px 4px;border-radius:3px;`);
  });
  body.querySelectorAll('del,s').forEach((el) => {
    setStyle(el, `text-decoration:line-through;opacity:0.7;`);
  });

  body.querySelectorAll('a').forEach((el) => {
    setStyle(el, `color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.accent};`);
    el.removeAttribute('target');
  });

  body.querySelectorAll('img').forEach((el) => {
    const alt = el.getAttribute('alt') ?? '';
    const src = el.getAttribute('src') ?? '';
    // 不渲染图片标题（figcaption）：避免文件名等 alt 文本出现在图片下方
    replaceWithHtml(
      el,
      `<figure style="${st('margin:20px 0;text-align:center;')}"><img src="${src}" alt="${escapeHtml(
        alt
      )}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;" /></figure>`
    );
  });

  body.querySelectorAll('table').forEach((el) => {
    setStyle(el, st('width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;'));
  });
  body.querySelectorAll('th').forEach((el) => {
    setStyle(
      el,
      `border:1px solid ${theme.hr};padding:8px 10px;background:${theme.quoteBg};font-weight:700;color:${theme.heading};text-align:left;`
    );
  });
  body.querySelectorAll('td').forEach((el) => {
    setStyle(el, `border:1px solid ${theme.hr};padding:8px 10px;color:${theme.text};`);
  });

  body.querySelectorAll('hr').forEach((el) => {
    replaceWithHtml(el, `<hr style="${st(`border:none;border-top:1px solid ${theme.hr};margin:28px 0;`)}" />`);
  });

  leftAlignReferenceSection(body);
}

/**
 * 末尾的「资料来源 / 参考资源 / 参考网址」等小节通常含长网址，
 * 两端对齐（justify）会把空格拉得很开，因此整段改为左对齐。
 * 识别到此类标题后，标题及其之后的所有同级内容都按左对齐处理。
 */
function leftAlignReferenceSection(body: HTMLElement): void {
  const refHeadingRe =
    /^\s*(资料来源|参考资料|参考网址|参考资源|参考文献|参考链接|相关链接|引用来源|延伸阅读|references?|sources?|links?)\s*[:：]?\s*$/i;

  const leftAlign = (el: Element): void => {
    const s = el.getAttribute('style') ?? '';
    const next = /text-align:[^;]*;?/.test(s)
      ? s.replace(/text-align:[^;]*;?/g, 'text-align:left;')
      : `${s}text-align:left;`;
    el.setAttribute('style', next);
  };

  const children = Array.from(body.children);
  let inRefSection = false;
  let refLevel = 0;
  for (const el of children) {
    const headingMatch = /^h([1-6])$/.exec(el.tagName.toLowerCase());
    if (headingMatch) {
      const level = Number(headingMatch[1]);
      if (!inRefSection && refHeadingRe.test(el.textContent ?? '')) {
        inRefSection = true;
        refLevel = level;
      } else if (inRefSection && level <= refLevel) {
        // 遇到同级或更高级别的标题，参考小节结束
        inRefSection = false;
      }
    }
    if (inRefSection) {
      leftAlign(el);
      el.querySelectorAll('p,li,td,th,figure').forEach(leftAlign);
    }
  }
}

/** 把库内图片解析为 data URL，并记录文中第一张图 */
async function resolveImages(
  app: App,
  body: HTMLElement,
  sourcePath: string
): Promise<ConvertResult['firstImage']> {
  let firstImage: ConvertResult['firstImage'] = null;

  for (const img of Array.from(body.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (!src) continue;

    if (src.startsWith('http://') || src.startsWith('https://')) {
      if (!firstImage) firstImage = { url: src };
      continue;
    }
    if (src.startsWith('data:')) {
      if (!firstImage) firstImage = {};
      continue;
    }

    let file: TFile | null = null;
    if (src.startsWith(VAULT_SCHEME)) {
      const path = decodeURIComponent(src.slice(VAULT_SCHEME.length));
      const af = app.vault.getAbstractFileByPath(path);
      if (af instanceof TFile) file = af;
    } else {
      file = app.metadataCache.getFirstLinkpathDest(decodeURIComponent(src), sourcePath);
    }

    if (file instanceof TFile && IMAGE_EXTENSIONS.includes(file.extension.toLowerCase())) {
      const buf = await app.vault.readBinary(file);
      const dataUrl = `data:${mimeFromExtension(file.extension)};base64,${arrayBufferToBase64(buf)}`;
      img.setAttribute('src', dataUrl);
      if (!firstImage) firstImage = { vaultPath: file.path };
    } else {
      // 无法解析的本地图片，移除避免公众号里出现裂图
      img.closest('figure')?.remove();
    }
  }
  return firstImage;
}

export async function convertFileToWechat(
  app: App,
  file: TFile,
  options: ConvertOptions
): Promise<ConvertResult> {
  const { theme } = options;
  const raw = await app.vault.cachedRead(file);

  const cache = app.metadataCache.getFileCache(file);
  const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
  const meta = {
    title: typeof fm.title === 'string' ? fm.title : undefined,
    author: typeof fm.author === 'string' ? fm.author : undefined,
    digest:
      typeof fm.digest === 'string' ? fm.digest : typeof fm.description === 'string' ? fm.description : undefined,
    cover: typeof fm.cover === 'string' ? fm.cover : undefined,
  };
  const title = meta.title ?? file.basename;

  const markdown = preprocessObsidianSyntax(app, stripFrontmatter(raw), file.path);
  marked.setOptions({ gfm: true, breaks: false });
  const rawHtml = marked.parse(markdown) as string;

  const doc = new DOMParser().parseFromString(`<body>${rawHtml}</body>`, 'text/html');
  const body = doc.body;

  const fontOffset = options.fontSizeOffset ?? 0;
  const spacingOffset = options.paraSpacingOffset ?? 0;
  applyThemeStyles(body, theme, fontOffset, spacingOffset);
  const firstImage = await resolveImages(app, body, file.path);

  const titleHtml = options.includeTitleInBody
    ? `<h1 style="${scaleStyle(
        `margin:0 0 24px;padding-left:12px;border-left:4px solid ${theme.accent};font-size:26px;line-height:1.4;color:${theme.heading};font-weight:700;`,
        fontOffset,
        spacingOffset
      )}">${escapeHtml(title)}</h1>`
    : '';

  const pageBgStyle = theme.pageBg ? `background:${theme.pageBg};padding:24px 20px;border-radius:8px;` : '';
  const html = `<section style="font-family:${theme.bodyFont};font-size:${Math.max(
    16 + fontOffset,
    9
  )}px;color:${theme.text};line-height:1.9;letter-spacing:0.5px;${pageBgStyle}">${titleHtml}${body.innerHTML.trim()}</section>`;

  const plainText = (body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();

  return { html, plainText, title, meta, firstImage };
}
