import katex from 'katex';
import { Marked, type TokenizerThis, type Tokens } from 'marked';

type MathToken = Tokens.Generic & {
  tex: string;
};

const MAX_RENDER_TEX_LENGTH = 12000;

function escapeHtml(str = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mathHtml(tex: string, displayMode: boolean): string {
  const escaped = escapeHtml(tex);
  return displayMode
    ? `<div class="math-block" data-tex="${escaped}">\\[${escaped}\\]</div>`
    : `<span class="math-inline" data-tex="${escaped}">\\(${escaped}\\)</span>`;
}

function textToken(raw: string): Tokens.Text {
  return { type: 'text', raw, text: raw };
}

function paragraphToken(ctx: TokenizerThis, raw: string): Tokens.Paragraph {
  const text = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  return { type: 'paragraph', raw, text, tokens: ctx.lexer.inline(text) };
}

function isMathBlockDelimiter(line: string): boolean {
  return /^(?: {0,3})\$\$[ \t]*$/.test(line);
}

function firstLineRaw(src: string): string {
  const lineEnd = src.indexOf('\n');
  return lineEnd === -1 ? src : src.slice(0, lineEnd + 1);
}

function findMathBlockStart(src: string): number {
  const match = /(?:^|\n)(?: {0,3})\$\$[ \t]*(?:\n|$)/.exec(src);
  if (!match) return -1;
  return match.index + (match[0].startsWith('\n') ? 1 : 0);
}

function findMathBlockClose(src: string, start: number): { start: number; end: number } | null {
  let lineStart = start;
  while (lineStart < src.length) {
    const newline = src.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? src.length : newline;
    if (isMathBlockDelimiter(src.slice(lineStart, lineEnd))) {
      return { start: lineStart, end: newline === -1 ? lineEnd : lineEnd + 1 };
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  return null;
}

function findInlineMathStart(src: string): number {
  for (let i = src.indexOf('$'); i !== -1; i = src.indexOf('$', i + 1)) {
    if (src[i + 1] && src[i + 1] !== '$' && !/\s/.test(src[i + 1])) return i;
  }
  return -1;
}

function findInlineMathEnd(src: string, start: number): number {
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '\n') return -1;
    if (ch !== '$') continue;
    if (src[i + 1] === '$' || /\s/.test(src[i - 1] ?? '')) return -1;
    return i;
  }
  return -1;
}

const markdownParser = new Marked({
  gfm: true,
  breaks: false,
  extensions: [
    {
      name: 'mathBlock',
      level: 'block',
      start: findMathBlockStart,
      tokenizer(this: TokenizerThis, src: string): MathToken | Tokens.Paragraph | undefined {
        const opening = /^(?: {0,3})\$\$[ \t]*(?:\n|$)/.exec(src);
        if (!opening) return undefined;

        const close = findMathBlockClose(src, opening[0].length);
        if (!close) return paragraphToken(this, firstLineRaw(src));

        const raw = src.slice(0, close.end);
        const tex = src.slice(opening[0].length, close.start).trim();
        if (!tex) return paragraphToken(this, raw);
        return { type: 'mathBlock', raw, tex };
      },
      renderer(token: Tokens.Generic): string {
        return mathHtml(String(token.tex ?? ''), true);
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start: findInlineMathStart,
      tokenizer(src: string): MathToken | Tokens.Text | undefined {
        if (src[0] !== '$') return undefined;
        if (src[1] === '$' || !src[1] || /\s/.test(src[1])) return textToken('$');

        const end = findInlineMathEnd(src, 1);
        if (end === -1) return textToken('$');

        const tex = src.slice(1, end).trim();
        if (!tex) return textToken('$');
        return { type: 'mathInline', raw: src.slice(0, end + 1), tex };
      },
      renderer(token: Tokens.Generic): string {
        return mathHtml(String(token.tex ?? ''), false);
      },
    },
  ],
});

export function parseMarkdownWithMath(markdown: string): string {
  return markdownParser.parse(markdown) as string;
}

function getMathTex(el: Element, open: RegExp, close: RegExp): string {
  const fromAttr = el.getAttribute('data-tex');
  if (fromAttr) return fromAttr;
  return (el.textContent ?? '').replace(open, '').replace(close, '').trim();
}

function setChildrenFromHtml(el: Element, html: string): void {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const fragment = el.ownerDocument.createDocumentFragment();
  while (doc.body.firstChild) {
    fragment.appendChild(el.ownerDocument.importNode(doc.body.firstChild, true));
  }
  el.replaceChildren(fragment);
}

export function renderMathToHtml(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    strict: 'ignore',
    output: 'mathml',
  });
}

export function renderMathInElement(container: ParentNode): void {
  container.querySelectorAll('.math-block').forEach((el) => {
    const tex = getMathTex(el, /^\\\[/, /\\\]$/);
    if (!tex) return;
    if (tex.length > MAX_RENDER_TEX_LENGTH) {
      el.textContent = `\\[${tex}\\]`;
      return;
    }
    try {
      setChildrenFromHtml(el, renderMathToHtml(tex, true));
    } catch {
      el.textContent = `\\[${tex}\\]`;
    }
  });

  container.querySelectorAll('.math-inline').forEach((el) => {
    const tex = getMathTex(el, /^\\\(/, /\\\)$/);
    if (!tex) return;
    if (tex.length > MAX_RENDER_TEX_LENGTH) {
      el.textContent = `\\(${tex}\\)`;
      return;
    }
    try {
      setChildrenFromHtml(el, renderMathToHtml(tex, false));
    } catch {
      el.textContent = `\\(${tex}\\)`;
    }
  });
}
