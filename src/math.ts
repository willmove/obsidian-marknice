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
  // 注意：必须用 appendChild「移动」节点，不能用 importNode「复制」。
  // importNode 不会从源文档移除节点，会使 while(doc.body.firstChild) 永远为真，
  // 从而无限复制节点直至内存耗尽（曾导致 Obsidian 在含公式文档上卡死/OOM）。
  while (doc.body.firstChild) {
    fragment.appendChild(doc.body.firstChild);
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

/**
 * 把 LaTeX 源码转换为线性可读纯文本，用于 Word 导出。
 *
 * Word 经 altChunk(MHT) 路径渲染时，既不支持 MathML，
 * 也不支持 KaTeX 的 CSS 定位排版（分数/根号/上下标会错位或丢失），
 * 且 mathml 输出里的 <annotation> 还会让每个公式重复一遍。
 *
 * 因此 Word 导出时把公式降级为线性文本：信息完整、任何 Word 版本都不会出错。
 * 优先用 Unicode 符号（²、√、≥、希腊字母等）提升可读性，
 * 无法识别的结构回退为原始 TeX，保证信息不丢失。
 */
const MATH_SYMBOLS: Record<string, string> = {
  // 希腊字母
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'π', rho: 'ρ',
  varrho: 'ρ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  // 关系/运算符
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈',
  equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝',
  pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', ast: '∗',
  cap: '∩', cup: '∪', setminus: '∖', subset: '⊂', subseteq: '⊆',
  supset: '⊃', supseteq: '⊇', in: '∈', notin: '∉', emptyset: '∅', varnothing: '∅',
  forall: '∀', exists: '∃', neg: '¬', lnot: '¬',
  rightarrow: '→', to: '→', leftarrow: '←', gets: '←',
  Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔',
  mapsto: '↦', uparrow: '↑', downarrow: '↓',
  infty: '∞', partial: '∂', nabla: '∇', angle: '∠', perp: '⊥', parallel: '∥',
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', oint: '∮', iint: '∬', iiint: '∭',
  bigcup: '⋃', bigcap: '⋂', bigvee: '⋁', bigwedge: '⋀',
  langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋',
  cdots: '⋯', ldots: '…', vdots: '⋮', ddots: '⋱',
  bullet: '•', prime: '′', dagger: '†', ddagger: '‡',
  triangle: '△', square: '□',
  mathbb: '', mathcal: '', mathrm: '', mathbf: '', mathit: '', operatorname: '', text: '', textrm: '', textit: '', textbf: '',
};

// Unicode 上标 / 下标（覆盖常用数字与部分字母）
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ', 's': 'ₛ', 't': 'ₜ',
};

/** 把一段已平衡的 {...} 内容（或单个 token）转成线性文本 */
function texGroupToLinear(tokens: string[], i: number, lenRef: { n: number }): string {
  // tokens[i] 是 '{'，返回花括号内内容并跳过匹配的 '}'
  let depth = 0;
  const out: string[] = [];
  let j = i;
  for (; j < tokens.length; j++) {
    if (tokens[j] === '{') {
      depth++;
      // 只收集团深度 >=2 的 '{'，最外层（depth==1）的 '{' 不进 out
      if (depth >= 2) out.push(tokens[j]);
    } else if (tokens[j] === '}') {
      depth--;
      if (depth === 0) break; // 最外层 '}'，结束
      out.push(tokens[j]); // depth>=1 的 '}' 是内部，保留
    } else if (depth >= 1) {
      out.push(tokens[j]);
    }
  }
  lenRef.n = j - i + 1; // 含外层 { }
  // 对内部内容递归（去掉外层花括号）
  return texToLinearInner(out);
}

/** 读取一个 LaTeX「参数」：跳过空白后，若是 {...} 取整组，否则取单个 token */
function readArg(tokens: string[], i: number, lenRef: { n: number }): string {
  let j = i;
  while (j < tokens.length && tokens[j] === ' ') j++;
  if (tokens[j] === '{') return texGroupToLinear(tokens, j, lenRef);
  // 单字符或反斜杠命令
  if (tokens[j] === '\\') {
    let k = j + 1;
    while (k < tokens.length && /[a-zA-Z]/.test(tokens[k])) k++;
    const cmd = tokens.slice(j + 1, k).join('');
    lenRef.n = (k - j) + (cmd.length > 0 ? 0 : 1);
    return cmd in MATH_SYMBOLS ? MATH_SYMBOLS[cmd] : `\\${cmd}`;
  }
  lenRef.n = j - i + 1;
  return tokens[j] ?? '';
}

function shiftMap(s: string, map: Record<string, string>): string {
  let out = '';
  for (const ch of s) out += map[ch] ?? ch;
  return out;
}

/** 将 token 数组转换为线性文本（核心递归） */
function texToLinearInner(tokens: string[]): string {
  let out = '';
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    if (t === '\\') {
      // 读取命令名
      let k = i + 1;
      while (k < tokens.length && /[a-zA-Z]/.test(tokens[k])) k++;
      const cmd = tokens.slice(i + 1, k).join('');
      const cmdLen = (k - (i + 1)) + 1; // 含反斜杠

      if (cmd === '') {
        // \\ 表示换行（KaTeX 里）或字面反斜杠；保留一个空格分隔
        out += ' ';
        i += 2;
        continue;
      }

      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac' || cmd === 'cfrac') {
        const r1 = { n: 0 };
        const a = readArg(tokens, k, r1);
        const r2 = { n: 0 };
        const b = readArg(tokens, k + r1.n, r2);
        // 分子分母若含运算符或为多字符，加括号提升可读性
        const wrap = (s: string): string => (/[+\-*/= ]/.test(s) && s.length > 1 ? `(${s})` : s);
        out += `${wrap(a)}/${wrap(b)}`;
        i = k + r1.n + r2.n;
        continue;
      }
      if (cmd === 'sqrt') {
        // \sqrt[n]{x} 或 \sqrt{x}
        let k2 = k;
        while (k2 < tokens.length && tokens[k2] === ' ') k2++;
        let rootStr = '';
        if (tokens[k2] === '[') {
          const end = tokens.indexOf(']', k2);
          if (end !== -1) {
            rootStr = texToLinearInner(tokens.slice(k2 + 1, end));
            k2 = end + 1;
          }
        }
        const r = { n: 0 };
        const body = readArg(tokens, k2, r);
        out += rootStr ? `√[${rootStr}]{${body}}` : `√${body.length > 1 ? `(${body})` : body}`;
        i = k2 + r.n;
        continue;
      }
      if (cmd === '^' || cmd === '_' ) {
        // 不会进到这里（^ _ 不是字母命令），留作保险
        i += cmdLen;
        continue;
      }
      if (cmd in MATH_SYMBOLS) {
        out += MATH_SYMBOLS[cmd];
        i += cmdLen;
        continue;
      }
      if (cmd === 'left' || cmd === 'right' || cmd === 'middle' || cmd === 'big' || cmd === 'Big' || cmd === 'Bigg' || cmd === 'bigg' || cmd === 'displaystyle' || cmd === 'textstyle' || cmd === 'limits' || cmd === 'nolimits' || cmd === 'scriptstyle' || cmd === 'noalign' || cmd === 'operatorname') {
        i += cmdLen;
        continue;
      }
      if (cmd === 'begin' || cmd === 'end') {
        // 环境名：跳过 {...}
        let k2 = k;
        while (k2 < tokens.length && tokens[k2] === ' ') k2++;
        if (tokens[k2] === '{') {
          const r = { n: 0 };
          texGroupToLinear(tokens, k2, r);
          k2 += r.n;
        }
        i = k2;
        continue;
      }
      // 未识别命令：原样保留，便于人工核对
      out += `\\${cmd}`;
      i += cmdLen;
      continue;
    }

    if (t === '^' || t === '_') {
      const map = t === '^' ? SUPERSCRIPT : SUBSCRIPT;
      const fallback = t === '^' ? '^' : '_';
      // 跳过空白
      let k = i + 1;
      while (k < tokens.length && tokens[k] === ' ') k++;
      let arg: string;
      const r = { n: 0 };
      if (tokens[k] === '{') {
        arg = texGroupToLinear(tokens, k, r);
      } else if (tokens[k] === '\\') {
        arg = readArg(tokens, k, r);
      } else {
        arg = tokens[k] ?? '';
        r.n = 1;
      }
      const converted = shiftMap(arg, map);
      const allConvertible = [...arg].every((ch) => ch in map);
      out += allConvertible ? converted : `${fallback}{${arg}}`;
      i = k + r.n;
      continue;
    }

    // 普通字符：跳过成对的 $ 与多余空白
    if (t === ' ' || t === '\t' || t === '\n') {
      i++;
      continue;
    }
    out += t;
    i++;
  }
  return out;
}

/** 把 LaTeX 字符串拆为字符级 token（反斜杠+字母序列作为整体命令前缀分开） */
function tokenizeTex(tex: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < tex.length;) {
    const ch = tex[i];
    if (ch === '\\') {
      tokens.push('\\');
      let j = i + 1;
      while (j < tex.length && /[a-zA-Z]/.test(tex[j])) {
        tokens.push(tex[j]);
        j++;
      }
      if (j === i + 1 && tex[j] && !/[a-zA-Z]/.test(tex[j])) {
        // \符号（如 \, \{ ）保留符号
        tokens.push(tex[j]);
        j++;
      }
      i = j;
    } else {
      tokens.push(ch);
      i++;
    }
  }
  return tokens;
}

export function texToLinearText(tex: string): string {
  const trimmed = tex.trim();
  if (!trimmed) return '';
  try {
    const linear = texToLinearInner(tokenizeTex(trimmed)).replace(/\s{2,}/g, ' ').trim();
    return linear || trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Word 导出预处理：把公式元素降级为线性可读纯文本。
 *
 * Word 的 altChunk(HTML) 渲染既不支持 MathML，也不支持 KaTeX 的 CSS 定位，
 * 故这里从 data-tex 还原 LaTeX 并转成线性文本，保证信息正确且不重复。
 */
export function rewriteMathForWord(container: ParentNode): void {
  const rewrite = (el: Element): void => {
    const tex = el.getAttribute('data-tex');
    if (!tex) return;
    el.textContent = texToLinearText(tex);
  };
  container.querySelectorAll('.math-block').forEach(rewrite);
  container.querySelectorAll('.math-inline').forEach(rewrite);
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
