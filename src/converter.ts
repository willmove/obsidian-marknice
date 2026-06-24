import { App, TFile, arrayBufferToBase64 } from 'obsidian';
import { WechatTheme } from './themes';
import { parseMarkdownWithMath, renderMathInElement } from './math';

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
  const wrapper = doc.body.firstElementChild;
  const fragment = document.createDocumentFragment();
  while (wrapper?.firstChild) {
    fragment.appendChild(wrapper.firstChild);
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

function detectHeadingNumberPrefix(text: string): { value: string; length: number } | null {
  const patterns = [
    /^\s*[（(]\s*([0-9]{1,2}|[一二三四五六七八九十百]+)\s*[)）][、.．:：]?\s*/,
    /^\s*([0-9]{1,2}|[一二三四五六七八九十百]+)\s*[、.．:：]\s*/,
    /^\s*([0-9]{1,2})\s+/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { value: match[1], length: match[0].length };
  }
  return null;
}

function stripTextPrefix(node: Node, count: number): number {
  if (!count) return 0;
  Array.from(node.childNodes).forEach((child) => {
    if (!count) return;
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.nodeValue ?? '';
      if (text.length <= count) {
        count -= text.length;
        child.nodeValue = '';
      } else {
        child.nodeValue = text.slice(count);
        count = 0;
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      count = stripTextPrefix(child, count);
    }
  });
  return count;
}

function warmredCircleHtml(label: string, block: boolean): string {
  const outerStyle = block
    ? 'display:block;text-align:center;margin-bottom:8px;'
    : 'display:inline-block;vertical-align:middle;margin-right:10px;';
  const circleStyle = block
    ? "display:inline-block;box-sizing:border-box;width:52px;height:52px;line-height:48px;border:2px solid #c0392b;border-radius:50%;background:transparent;color:#c0392b;font-size:24px;font-weight:900;text-align:center;font-family:'DIN Alternate','Impact','Arial Black',sans-serif;letter-spacing:1px;"
    : "display:inline-block;box-sizing:border-box;min-width:40px;height:40px;line-height:36px;padding:0 8px;border:2px solid #c0392b;border-radius:999px;background:transparent;color:#c0392b;font-size:16px;font-weight:900;text-align:center;font-family:'DIN Alternate','Impact','Arial Black',sans-serif;letter-spacing:0;";
  return `<span style="${outerStyle}"><span style="${circleStyle}">${escapeHtml(label)}</span></span>`;
}

function applyWarmredHeadingNumbers(body: HTMLElement, spacingOffset: number): void {
  let h2Counter = 0;
  const h2TopMargin = Math.max((32 + spacingOffset) * 2, 0);
  const h2BottomMargin = Math.max((16 + spacingOffset) / 2, 0);
  body.querySelectorAll('h2').forEach((el) => {
    const numbered = detectHeadingNumberPrefix(el.textContent ?? '');
    const wrapper = body.ownerDocument.createElement('div');
    wrapper.setAttribute('style', `text-align:center;margin:${h2TopMargin}px 0 ${h2BottomMargin}px;padding:0;`);
    el.parentNode?.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    const h2Style = (el.getAttribute('style') ?? '').replace(/margin:[^;]+;?/g, '');
    el.setAttribute('style', `${h2Style};margin:0;`);
    if (numbered) {
      const numericValue = /^[0-9]+$/.test(numbered.value) ? Number(numbered.value) : null;
      h2Counter = numericValue || h2Counter + 1;
      stripTextPrefix(el, numbered.length);
      el.insertBefore(htmlToNodes(warmredCircleHtml(numbered.value, false)), el.firstChild);
    } else {
      h2Counter += 1;
      wrapper.insertBefore(htmlToNodes(warmredCircleHtml(String(h2Counter).padStart(2, '0'), true)), wrapper.firstChild);
    }
  });
}

function amberHeadingHtml(
  tagName: 'h1' | 'h2',
  text: string,
  fontOffset: number,
  spacingOffset: number,
  marginOverride?: string
): string {
  const isH1 = tagName === 'h1';
  const style = scaleStyle(
    `font-size:${isH1 ? 20 : 18}px;line-height:1.6;font-weight:800;margin:${
      marginOverride ?? (isH1 ? '40px 0 28px' : '36px 0 24px')
    };color:#fff;text-align:center;background:#c8722a;border-radius:8px;padding:${
      isH1 ? '10px 28px' : '8px 24px'
    };display:inline-block;width:auto;`,
    fontOffset,
    spacingOffset
  );
  return `<div style="text-align:center;margin:0;padding:0;"><${tagName} style="${style}">${escapeHtml(
    text
  )}</${tagName}></div>`;
}

function applyAmberOrderedListMarkers(body: HTMLElement): void {
  body.querySelectorAll('ol').forEach((ol) => {
    ol.querySelectorAll(':scope > li').forEach((li, index) => {
      li.insertBefore(
        htmlToNodes(`<span style="color:#c8722a;font-weight:700;">${index + 1}、</span>`),
        li.firstChild
      );
    });
  });
}

function headingStyle(
  theme: WechatTheme,
  fontOffset: number,
  spacingOffset: number,
  opts: {
    margin: string;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    paddingLeft: number;
    bgPadding: string;
    bgRadius: number;
    tailHeight: number;
    tailWidth: number;
  }
): string {
  if (theme.headingVariant === 'ribbon') {
    return scaleStyle(
      `margin:${opts.margin};border-bottom:2px solid ${
        theme.headingLine ?? theme.accent
      };line-height:0;`,
      fontOffset,
      spacingOffset
    );
  }
  if (theme.headingBg) {
    return scaleStyle(
      `margin:${opts.margin};padding:${opts.bgPadding};background:${theme.headingBg};border-radius:${opts.bgRadius}px;color:${
        theme.headingText ?? theme.heading
      };font-size:${opts.fontSize}px;line-height:${opts.lineHeight};font-weight:${opts.fontWeight};box-shadow:0 10px 24px rgba(79,70,229,0.16);`,
      fontOffset,
      spacingOffset
    );
  }
  return scaleStyle(
    `margin:${opts.margin};padding-left:${opts.paddingLeft}px;border-left:4px solid ${theme.accent};font-size:${opts.fontSize}px;line-height:${opts.lineHeight};color:${theme.heading};font-weight:${opts.fontWeight};`,
    fontOffset,
    spacingOffset
  );
}

function ribbonHeadingHtml(
  theme: WechatTheme,
  text: string,
  fontOffset: number,
  spacingOffset: number,
  opts: Parameters<typeof headingStyle>[3]
): string {
  const wrapStyle = headingStyle(theme, fontOffset, spacingOffset, opts);
  const labelStyle = scaleStyle(
    `display:inline-block;box-sizing:border-box;max-width:88%;padding:${opts.bgPadding};background:${
      theme.headingBg ?? theme.accent
    };border-radius:${opts.bgRadius}px ${opts.bgRadius}px 0 0;color:${
      theme.headingText ?? '#ffffff'
    };font-size:${opts.fontSize}px;line-height:${opts.lineHeight};font-weight:${
      opts.fontWeight
    };letter-spacing:0;vertical-align:bottom;`,
    fontOffset,
    spacingOffset
  );
  const tailStyle = `display:inline-block;width:0;height:0;border-left:${opts.tailWidth}px solid ${
    theme.headingTailBg ?? '#e5e7eb'
  };border-top:${opts.tailHeight}px solid transparent;vertical-align:bottom;`;
  return `<section style="${wrapStyle}"><section style="${labelStyle}">${escapeHtml(
    text
  )}</section><span style="${tailStyle}"></span></section>`;
}

/**
 * 把 marked 输出的通用 HTML 转成微信编辑器安全的内联样式 HTML。
 * 公众号编辑器会丢弃 <style> 与 class，因此所有视觉信息必须落在 style 属性上。
 */
function applyThemeStyles(body: HTMLElement, theme: WechatTheme, fontOffset = 0, spacingOffset = 0): void {
  const strongColor = theme.strong ?? theme.heading;
  const codeText = theme.codeText ?? theme.text;
  const st = (css: string): string => scaleStyle(css, fontOffset, spacingOffset);
  const isWarmred = theme.id === 'warmred';
  const isAmber = theme.id === 'amber';

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
      isWarmred
        ? st('font-size:15px;line-height:2.0;margin:14px 0;color:#3b2e2a;text-align:justify;letter-spacing:.3px;word-break:break-word;')
        : isAmber
          ? st('font-size:15px;line-height:2.0;margin:18px 0;color:#2c2c2c;text-align:justify;letter-spacing:.2px;word-break:break-word;')
        : st(`margin:16px 0;line-height:1.9;color:${theme.text};font-size:16px;word-break:break-word;text-align:justify;`)
    );
  });

  body.querySelectorAll('h1').forEach((el) => {
    if (isWarmred) {
      setStyle(el, st('font-size:24px;line-height:1.6;font-weight:800;margin:36px 0 18px;color:#c0392b;text-align:center;'));
      return;
    }
    if (isAmber) {
      replaceWithHtml(el, amberHeadingHtml('h1', el.textContent ?? '', fontOffset, spacingOffset));
      return;
    }
    const opts = {
      margin: '28px 0 18px',
      fontSize: 24,
      lineHeight: 1.4,
      fontWeight: 800,
      paddingLeft: 12,
      bgPadding: '8px 14px 7px',
      bgRadius: 3,
      tailHeight: 48,
      tailWidth: 26,
    };
    if (theme.headingVariant === 'ribbon') {
      replaceWithHtml(el, ribbonHeadingHtml(theme, el.textContent ?? '', fontOffset, spacingOffset, opts));
      return;
    }
    setStyle(
      el,
      headingStyle(theme, fontOffset, spacingOffset, opts)
    );
  });
  body.querySelectorAll('h2').forEach((el) => {
    if (isWarmred) {
      setStyle(
        el,
        st('font-size:20px;line-height:1.6;font-weight:700;margin:32px 0 16px;color:#c0392b;text-align:center;border-bottom:2px solid #c0392b;padding-bottom:8px;display:inline-block;')
      );
      return;
    }
    if (isAmber) {
      replaceWithHtml(el, amberHeadingHtml('h2', el.textContent ?? '', fontOffset, spacingOffset));
      return;
    }
    const opts = {
      margin: '24px 0 14px',
      fontSize: 21,
      lineHeight: 1.45,
      fontWeight: 800,
      paddingLeft: 10,
      bgPadding: '7px 13px 6px',
      bgRadius: 3,
      tailHeight: 42,
      tailWidth: 23,
    };
    if (theme.headingVariant === 'ribbon') {
      replaceWithHtml(el, ribbonHeadingHtml(theme, el.textContent ?? '', fontOffset, spacingOffset, opts));
      return;
    }
    setStyle(
      el,
      headingStyle(theme, fontOffset, spacingOffset, opts)
    );
  });
  if (isWarmred) applyWarmredHeadingNumbers(body, spacingOffset);
  body.querySelectorAll('h3').forEach((el) => {
    setStyle(
      el,
      isWarmred
        ? st('font-size:17px;line-height:1.6;font-weight:700;margin:28px 0 12px;color:#c0392b;')
        : isAmber
          ? st('font-size:16px;line-height:1.6;font-weight:700;margin:30px 0 18px;color:#c8722a;')
        : st(`margin:20px 0 12px;font-size:18px;line-height:1.5;color:${theme.heading};font-weight:700;`)
    );
  });
  body.querySelectorAll('h4,h5,h6').forEach((el) => {
    if (isWarmred) {
      const tag = el.tagName.toLowerCase();
      const style =
        tag === 'h4'
          ? 'font-size:15px;line-height:1.6;font-weight:700;margin:22px 0 10px;color:#a93226;'
          : tag === 'h5'
            ? 'font-size:14px;line-height:1.6;font-weight:700;margin:18px 0 8px;color:#a93226;'
            : 'font-size:13px;line-height:1.6;font-weight:700;margin:14px 0 8px;color:#a93226;';
      setStyle(el, st(style));
      return;
    }
    if (isAmber) {
      const tag = el.tagName.toLowerCase();
      const style =
        tag === 'h4'
          ? 'font-size:15px;line-height:1.6;font-weight:700;margin:24px 0 14px;color:#c8722a;'
          : tag === 'h5'
            ? 'font-size:14px;line-height:1.6;font-weight:700;margin:20px 0 12px;color:#c8722a;'
            : 'font-size:13px;line-height:1.6;font-weight:700;margin:16px 0 10px;color:#c8722a;';
      setStyle(el, st(style));
      return;
    }
    setStyle(el, st(`margin:18px 0 10px;font-size:17px;line-height:1.6;color:${theme.heading};font-weight:600;`));
  });

  body.querySelectorAll('blockquote').forEach((el) => {
    setStyle(
      el,
      isWarmred
        ? st('margin:18px 0;padding:14px 18px;border-left:4px solid #c0392b;background:#fef5f0;color:#7a2e1f;font-size:14px;line-height:1.9;border-radius:0 8px 8px 0;')
        : isAmber
          ? st('margin:20px 0;padding:14px 18px;border-left:4px solid #c8722a;background:#fdf5ec;color:#7a4010;font-size:14px;line-height:1.95;border-radius:0 8px 8px 0;')
        : st(`margin:18px 0;padding:12px 16px;background:${theme.quoteBg};border-left:4px solid ${theme.quoteBorder};color:${theme.text};border-radius:6px;`)
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
    if (isAmber) {
      const tag = el.tagName.toLowerCase();
      setStyle(
        el,
        st(
          tag === 'ol'
            ? 'margin:16px 0;padding-left:0;line-height:2.0;color:#2c2c2c;font-size:15px;list-style:none;'
            : 'margin:16px 0;padding-left:22px;line-height:2.0;color:#2c2c2c;font-size:15px;'
        )
      );
    } else {
      setStyle(el, st(`margin:14px 0 14px 1.2em;padding:0;color:${theme.text};line-height:1.9;`));
    }
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
    setStyle(el, isAmber ? st('margin:10px 0;') : st(`margin:6px 0;font-size:16px;`));
  });
  if (isAmber) applyAmberOrderedListMarkers(body);

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
        isAmber
          ? 'background:#fdf5ec;border:1px solid #f0d5b0;border-radius:8px;padding:14px;overflow:auto;line-height:1.65;font-size:12px;color:#a05a20;font-family:Menlo,Consolas,monospace;white-space:normal;word-break:break-all;margin:18px 0;'
          : `margin:18px 0;padding:14px 16px;overflow:auto;background:${theme.codeBg};border-radius:8px;color:${codeText};font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.7;white-space:normal;word-break:break-all;`
      )}">${codeHtml}</pre>`
    );
  });

  body.querySelectorAll('code').forEach((el) => {
    if (el.parentElement?.tagName.toLowerCase() === 'pre') return;
    replaceWithHtml(
      el,
      `<code style="${
        isAmber
          ? 'background:#faebd7;padding:2px 6px;border-radius:4px;font-size:90%;font-family:Menlo,Consolas,monospace;color:#a05a20;display:inline;white-space:normal;'
          : `font-family:Menlo,Consolas,monospace;background:${theme.codeBg};color:${theme.accent};display:inline;white-space:normal;padding:2px 6px;border-radius:4px;font-size:0.92em;`
      }">${escapeHtml(
        el.textContent ?? ''
      )}</code>`
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
    setStyle(
      el,
      isAmber
        ? 'color:#c8722a;text-decoration:none;border-bottom:1px solid #e8b07a;'
        : `color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.accent};`
    );
    el.removeAttribute('target');
  });

  body.querySelectorAll('img').forEach((el) => {
    const alt = el.getAttribute('alt') ?? '';
    const src = el.getAttribute('src') ?? '';
    // 不渲染图片标题（figcaption）：避免文件名等 alt 文本出现在图片下方
    replaceWithHtml(
      el,
      `<figure style="${st(isAmber ? 'margin:0;text-align:center;' : 'margin:20px 0;text-align:center;')}"><img src="${src}" alt="${escapeHtml(
        alt
      )}" style="${
        isAmber
          ? 'max-width:100%;height:auto;border-radius:8px;display:block;margin:24px auto;'
          : 'max-width:100%;height:auto;border-radius:8px;display:inline-block;'
      }" /></figure>`
    );
  });

  body.querySelectorAll('table').forEach((el) => {
    setStyle(
      el,
      isAmber
        ? st('border-collapse:collapse;width:100%;margin:16px 0;font-size:13px;')
        : st('width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;')
    );
  });
  body.querySelectorAll('th').forEach((el) => {
    setStyle(
      el,
      isAmber
        ? 'border:1px solid #f0d5b0;padding:10px;background:#fdf0e0;text-align:left;color:#7a4010;'
        : `border:1px solid ${theme.hr};padding:8px 10px;background:${theme.quoteBg};font-weight:700;color:${theme.heading};text-align:left;`
    );
  });
  body.querySelectorAll('td').forEach((el) => {
    setStyle(el, isAmber ? 'border:1px solid #f0d5b0;padding:10px;color:#2c2c2c;' : `border:1px solid ${theme.hr};padding:8px 10px;color:${theme.text};`);
  });

  body.querySelectorAll('hr').forEach((el) => {
    replaceWithHtml(el, `<hr style="${st(isAmber ? 'border:none;border-top:1px solid #f0d5b0;margin:28px 0;' : `border:none;border-top:1px solid ${theme.hr};margin:28px 0;`)}" />`);
  });

  body.querySelectorAll('.math-block').forEach((el) => {
    setStyle(
      el,
      st(`display:block;margin:18px 0;text-align:center;overflow-x:auto;line-height:1.5;color:${theme.text};font-size:16px;`)
    );
  });
  body.querySelectorAll('.math-inline').forEach((el) => {
    setStyle(el, `display:inline-block;vertical-align:middle;color:${theme.text};font-size:1em;`);
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
  const rawHtml = parseMarkdownWithMath(markdown);

  const doc = new DOMParser().parseFromString(`<body>${rawHtml}</body>`, 'text/html');
  const body = doc.body;

  const fontOffset = options.fontSizeOffset ?? 0;
  const spacingOffset = options.paraSpacingOffset ?? 0;
  const isAmber = theme.id === 'amber';
  applyThemeStyles(body, theme, fontOffset, spacingOffset);
  const firstImage = await resolveImages(app, body, file.path);
  const plainText = (body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
  renderMathInElement(body);

  const titleHtml = options.includeTitleInBody
    ? isAmber
      ? amberHeadingHtml('h1', title, fontOffset, spacingOffset, '0px 0 28px')
      : theme.headingVariant === 'ribbon'
      ? ribbonHeadingHtml(theme, title, fontOffset, spacingOffset, {
          margin: '0px 0 24px',
          fontSize: 26,
          lineHeight: 1.4,
          fontWeight: 800,
          paddingLeft: 12,
          bgPadding: '8px 16px 7px',
          bgRadius: 3,
          tailHeight: 51,
          tailWidth: 28,
        })
      : `<h1 style="${headingStyle(theme, fontOffset, spacingOffset, {
        margin: '0px 0 24px',
        fontSize: 26,
        lineHeight: 1.4,
        fontWeight: 800,
        paddingLeft: 12,
        bgPadding: '12px 16px',
        bgRadius: 14,
        tailHeight: 51,
        tailWidth: 28,
      })}">${escapeHtml(title)}</h1>`
    : '';

  const pageBgStyle = theme.pageBg
    ? `background:${theme.pageBg};${
        theme.pageBgSize ? `background-size:${theme.pageBgSize};` : ''
      }padding:24px 20px;border-radius:8px;`
    : '';
  const sectionStyle = isAmber
    ? `font-family:${theme.bodyFont};word-break:break-word;color:${theme.text};${pageBgStyle}`
    : `font-family:${theme.bodyFont};font-size:${Math.max(
        16 + fontOffset,
        9
      )}px;color:${theme.text};line-height:1.9;letter-spacing:0.5px;${pageBgStyle}`;
  const html = `<section style="${sectionStyle}">${titleHtml}${body.innerHTML.trim()}</section>`;

  return { html, plainText, title, meta, firstImage };
}
