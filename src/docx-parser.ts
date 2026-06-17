import { unzipArrayBuffer, zipBase64, zipText } from './zip-utils';

type NumberLevel = {
  numFmt: string;
  lvlText: string;
  start: number;
};

type RunFormat = {
  b: boolean;
  i: boolean;
  u: boolean;
  s: boolean;
  va: string;
};

type TextSegment = { text: string; fmt: RunFormat };
type RawSegment = { raw: string };
type Segment = TextSegment | RawSegment;

function qn(parent: Node | null, name: string): Element | null {
  if (!parent) return null;
  const parts = name.split('>').map((part) => part.trim());
  let current: Node | null = parent;
  for (const part of parts) {
    let found: Element | null = null;
    for (let child = current.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === part) {
        found = child as Element;
        break;
      }
    }
    if (!found) return null;
    current = found;
  }
  return current as Element;
}

function qnAll(parent: Node | null, name: string): Element[] {
  const result: Element[] = [];
  if (!parent) return result;
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === name) {
      result.push(child as Element);
    }
  }
  return result;
}

function qnDeep(parent: Document | Element | null, name: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.getElementsByTagName('*')).filter((el) => el.localName === name);
}

function attr(el: Element | null, name: string): string {
  if (!el) return '';
  return (
    el.getAttribute(`w:${name}`) ||
    el.getAttribute(`m:${name}`) ||
    el.getAttribute(`r:${name}`) ||
    el.getAttribute(name) ||
    ''
  );
}

function escapeHtml(str = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toRoman(value: number): string {
  const nums = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const romans = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let n = value;
  let out = '';
  for (let i = 0; i < nums.length; i++) {
    while (n >= nums[i]) {
      out += romans[i];
      n -= nums[i];
    }
  }
  return out;
}

function toChineseCounting(value: number): string {
  const chars = ['', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d', '\u4e03', '\u516b', '\u4e5d', '\u5341'];
  if (value >= 0 && value <= 10) return chars[value];
  if (value < 20) return `\u5341${value % 10 ? chars[value % 10] : ''}`;
  return String(value);
}

function formatNumber(value: number, fmt: string): string {
  switch (fmt) {
    case 'upperRoman':
      return toRoman(value);
    case 'lowerRoman':
      return toRoman(value).toLowerCase();
    case 'upperLetter':
      return String.fromCharCode(65 + ((value - 1) % 26));
    case 'lowerLetter':
      return String.fromCharCode(97 + ((value - 1) % 26));
    case 'chineseCounting':
    case 'ideographTraditional':
      return toChineseCounting(value);
    default:
      return String(value);
  }
}

function ommlToLatex(node: Node): string {
  const parts: string[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    switch (el.localName) {
      case 'r': {
        const text = qn(el, 't');
        if (text) parts.push(text.textContent ?? '');
        break;
      }
      case 'f': {
        const num = qn(el, 'num');
        const den = qn(el, 'den');
        parts.push(`\\frac{${num ? ommlToLatex(num) : ''}}{${den ? ommlToLatex(den) : ''}}`);
        break;
      }
      case 'rad': {
        const deg = qn(el, 'deg');
        const expr = qn(el, 'e');
        const base = expr ? ommlToLatex(expr) : '';
        const degree = deg ? ommlToLatex(deg).trim() : '';
        parts.push(degree ? `\\sqrt[${degree}]{${base}}` : `\\sqrt{${base}}`);
        break;
      }
      case 'sSup': {
        parts.push(`${ommlToLatex(qn(el, 'e') ?? el)}^{${ommlToLatex(qn(el, 'sup') ?? el)}}`);
        break;
      }
      case 'sSub': {
        parts.push(`${ommlToLatex(qn(el, 'e') ?? el)}_{${ommlToLatex(qn(el, 'sub') ?? el)}}`);
        break;
      }
      case 'sSubSup': {
        const expr = qn(el, 'e');
        const sub = qn(el, 'sub');
        const sup = qn(el, 'sup');
        parts.push(`${expr ? ommlToLatex(expr) : ''}_{${sub ? ommlToLatex(sub) : ''}}^{${sup ? ommlToLatex(sup) : ''}}`);
        break;
      }
      case 'nary': {
        const chr = qn(qn(el, 'naryPr'), 'chr');
        const sym = attr(chr, 'val') || '\u2211';
        const map: Record<string, string> = {
          '\u2211': '\\sum',
          '\u222b': '\\int',
          '\u220f': '\\prod',
          '\u222e': '\\oint',
        };
        let latex = map[sym] || sym;
        const sub = qn(el, 'sub');
        const sup = qn(el, 'sup');
        const expr = qn(el, 'e');
        if (sub) latex += `_{${ommlToLatex(sub)}}`;
        if (sup) latex += `^{${ommlToLatex(sup)}}`;
        if (expr) latex += ` ${ommlToLatex(expr)}`;
        parts.push(latex);
        break;
      }
      case 'd': {
        const dPr = qn(el, 'dPr');
        const beg = attr(qn(dPr, 'begChr'), 'val') || '(';
        const end = attr(qn(dPr, 'endChr'), 'val') || ')';
        const left: Record<string, string> = { '(': '(', '[': '[', '{': '\\{', '|': '|' };
        const right: Record<string, string> = { ')': ')', ']': ']', '}': '\\}', '|': '|' };
        const inner = qnAll(el, 'e').map((expr) => ommlToLatex(expr)).join(', ');
        parts.push(`\\left${left[beg] || beg}${inner}\\right${right[end] || end}`);
        break;
      }
      case 'func': {
        const fn = qn(el, 'fName');
        const expr = qn(el, 'e');
        parts.push(`\\${fn ? ommlToLatex(fn).trim() : ''}{${expr ? ommlToLatex(expr) : ''}}`);
        break;
      }
      case 'acc': {
        const ac = attr(qn(qn(el, 'accPr'), 'chr'), 'val') || '\u0302';
        const expr = qn(el, 'e');
        const map: Record<string, string> = {
          '\u0302': '\\hat',
          '\u0304': '\\bar',
          '\u0303': '\\tilde',
          '\u0307': '\\dot',
          '\u0308': '\\ddot',
          '\u20d7': '\\vec',
          '\u0305': '\\overline',
        };
        parts.push(`${map[ac] || '\\hat'}{${expr ? ommlToLatex(expr) : ''}}`);
        break;
      }
      case 'bar': {
        const pos = attr(qn(qn(el, 'barPr'), 'pos'), 'val') || 'top';
        const expr = qn(el, 'e');
        const inner = expr ? ommlToLatex(expr) : '';
        parts.push(pos === 'bot' ? `\\underline{${inner}}` : `\\overline{${inner}}`);
        break;
      }
      case 'm': {
        const rows = qnAll(el, 'mr').map((row) => qnAll(row, 'e').map((expr) => ommlToLatex(expr)).join(' & '));
        parts.push(`\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`);
        break;
      }
      case 'eqArr': {
        const rows = qnAll(el, 'e').map((expr) => ommlToLatex(expr));
        parts.push(`\\begin{aligned}${rows.join(' \\\\ ')}\\end{aligned}`);
        break;
      }
      case 'limLow': {
        const expr = qn(el, 'e');
        const lim = qn(el, 'lim');
        parts.push(`${expr ? ommlToLatex(expr) : ''}_{${lim ? ommlToLatex(lim) : ''}}`);
        break;
      }
      case 'limUpp': {
        const expr = qn(el, 'e');
        const lim = qn(el, 'lim');
        parts.push(`${expr ? ommlToLatex(expr) : ''}^{${lim ? ommlToLatex(lim) : ''}}`);
        break;
      }
      case 'box':
      case 'borderBox':
      case 'groupChr': {
        const expr = qn(el, 'e');
        if (expr) parts.push(ommlToLatex(expr));
        break;
      }
      default: {
        const inner = ommlToLatex(el);
        if (inner) parts.push(inner);
      }
    }
  }
  return parts.join('');
}

function normalizeZipPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function isRawSegment(segment: Segment): segment is RawSegment {
  return 'raw' in segment;
}

export async function parseDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = unzipArrayBuffer(arrayBuffer);

  const abstractNums: Record<string, Record<string, NumberLevel>> = {};
  const numToAbstract: Record<string, string> = {};
  const numOverrides: Record<string, Record<string, { start: number }>> = {};

  const numberingXml = zipText(zip, 'word/numbering.xml');
  if (numberingXml) {
    const numberingDoc = parseXml(numberingXml);
    qnDeep(numberingDoc, 'abstractNum').forEach((abstractNum) => {
      const id = attr(abstractNum, 'abstractNumId');
      const levels: Record<string, NumberLevel> = {};
      qnDeep(abstractNum, 'lvl').forEach((level) => {
        const ilvl = attr(level, 'ilvl');
        levels[ilvl] = {
          numFmt: attr(qn(level, 'numFmt'), 'val') || 'decimal',
          lvlText: attr(qn(level, 'lvlText'), 'val') || '',
          start: Number.parseInt(attr(qn(level, 'start'), 'val') || '1', 10),
        };
      });
      abstractNums[id] = levels;
    });

    qnDeep(numberingDoc, 'num').forEach((num) => {
      const numId = attr(num, 'numId');
      const abstractNumId = attr(qn(num, 'abstractNumId'), 'val');
      if (!numId || !abstractNumId) return;
      numToAbstract[numId] = abstractNumId;
      qnDeep(num, 'lvlOverride').forEach((override) => {
        const ilvl = attr(override, 'ilvl');
        const startOverride = qn(override, 'startOverride');
        if (!startOverride) return;
        if (!numOverrides[numId]) numOverrides[numId] = {};
        numOverrides[numId][ilvl] = { start: Number.parseInt(attr(startOverride, 'val'), 10) };
      });
    });
  }

  const styleNumIds: Record<string, { numId: string; ilvl: string }> = {};
  const styleOutlineLevel: Record<string, number> = {};
  const stylesXml = zipText(zip, 'word/styles.xml');
  if (stylesXml) {
    const stylesDoc = parseXml(stylesXml);
    qnDeep(stylesDoc, 'style').forEach((style) => {
      const styleId = attr(style, 'styleId');
      const pPr = qn(style, 'pPr');
      if (!styleId || !pPr) return;

      const numPr = qn(pPr, 'numPr');
      if (numPr) {
        const numId = attr(qn(numPr, 'numId'), 'val');
        const ilvl = attr(qn(numPr, 'ilvl'), 'val') || '0';
        if (numId && numId !== '0') styleNumIds[styleId] = { numId, ilvl };
      }

      const outline = qn(pPr, 'outlineLvl');
      if (outline) {
        const level = Number.parseInt(attr(outline, 'val') || '-1', 10);
        if (level >= 0 && level <= 8) styleOutlineLevel[styleId] = level + 1;
      }
    });
  }

  const rels: Record<string, string> = {};
  const relsXml = zipText(zip, 'word/_rels/document.xml.rels');
  if (relsXml) {
    const relsDoc = parseXml(relsXml);
    qnDeep(relsDoc, 'Relationship').forEach((rel) => {
      const id = rel.getAttribute('Id') || '';
      const target = rel.getAttribute('Target') || '';
      if (id && target) rels[id] = target;
    });
  }

  async function getImageDataUri(rId: string): Promise<string> {
    const target = rels[rId];
    if (!target || /^https?:\/\//i.test(target)) return target || '';
    const zipPath = target.startsWith('/') ? target.slice(1) : normalizeZipPath(`word/${target}`);
    const base64 = zipBase64(zip, zipPath);
    if (!base64) return '';
    const ext = (target.split(/[?#]/)[0].split('.').pop() || '').toLowerCase();
    const mime: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    };
    return `data:${mime[ext] || 'image/png'};base64,${base64}`;
  }

  const documentXml = zipText(zip, 'word/document.xml');
  if (!documentXml) return '<p>Unable to read document content</p>';
  const documentDoc = parseXml(documentXml);
  const body = qn(documentDoc.documentElement, 'body');
  if (!body) return '<p>Unable to read document content</p>';

  const numCounters: Record<string, Record<string, number>> = {};
  const seqCounters: Record<string, number> = {};

  function getHeadingLevel(pStyle: string, pPr: Element | null): number {
    if (pStyle) {
      let match = pStyle.match(/^[Hh][Ee][Aa][Dd][Ii][Nn][Gg]\s*(\d)$/);
      if (match) return Number.parseInt(match[1], 10);
      match = pStyle.match(/^\u6807\u9898\s*(\d)$/);
      if (match) return Number.parseInt(match[1], 10);
      match = pStyle.match(/^(\d)$/);
      if (match) return Number.parseInt(match[1], 10);
      if (styleOutlineLevel[pStyle]) return styleOutlineLevel[pStyle];
    }

    const outline = pPr ? qn(pPr, 'outlineLvl') : null;
    if (outline) {
      const level = Number.parseInt(attr(outline, 'val') || '-1', 10);
      if (level >= 0 && level <= 8) return level + 1;
    }
    return 0;
  }

  function isTocHeading(text: string): boolean {
    return /^(\u76ee\u5f55|table\s+of\s+contents|contents|toc)$/i.test(text.trim());
  }

  function resolveNumbering(numId: string, ilvl: number): string {
    const abstractId = numToAbstract[numId];
    const levels = abstractId ? abstractNums[abstractId] : undefined;
    const level = levels?.[String(ilvl)];
    if (!level) return '';
    if (level.numFmt === 'bullet') return '\0BULLET';

    if (!numCounters[numId]) numCounters[numId] = {};
    const key = String(ilvl);
    if (numCounters[numId][key] === undefined) {
      numCounters[numId][key] = numOverrides[numId]?.[key]?.start ?? level.start ?? 1;
    } else {
      numCounters[numId][key]++;
    }
    for (let i = ilvl + 1; i <= 8; i++) delete numCounters[numId][String(i)];

    if (level.lvlText) {
      let prefix = level.lvlText;
      for (let i = 0; i <= ilvl; i++) {
        const value = numCounters[numId][String(i)] ?? 1;
        const fmt = levels?.[String(i)]?.numFmt ?? 'decimal';
        prefix = prefix.replace(`%${i + 1}`, formatNumber(value, fmt));
      }
      return prefix;
    }

    const parts: string[] = [];
    for (let i = 0; i <= ilvl; i++) parts.push(String(numCounters[numId][String(i)] ?? 1));
    return parts.join('.');
  }

  function getRunText(run: Element): string {
    let text = '';
    for (let child = run.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (el.localName === 't') text += el.textContent ?? '';
      else if (el.localName === 'tab') text += '\t';
      else if (el.localName === 'br') text += '\n';
      else if (el.localName === 'sym') {
        const code = attr(el, 'char');
        if (code) text += String.fromCodePoint(Number.parseInt(code, 16));
      }
    }
    return text;
  }

  function processField(instr: string, result: string): string {
    const trimmed = instr.trim();
    const seq = trimmed.match(/SEQ\s+(\S+)/i);
    if (seq) {
      const name = seq[1];
      seqCounters[name] = (seqCounters[name] ?? 0) + 1;
      return String(seqCounters[name]);
    }
    if (/STYLEREF/i.test(trimmed) && result.trim()) return escapeHtml(result.trim());
    if (result.trim()) return escapeHtml(result.trim());
    return '';
  }

  async function processDrawing(drawing: Element): Promise<string> {
    const blip = qnDeep(drawing, 'blip')[0];
    if (!blip) return '';
    const rId = blip.getAttribute('r:embed') || blip.getAttribute('r:link') || '';
    if (!rId) return '';
    const src = await getImageDataUri(rId);
    if (!src) return '';
    const docPr = qnDeep(drawing, 'docPr')[0];
    const alt = docPr?.getAttribute('descr') || docPr?.getAttribute('title') || '';
    return `<img src="${src}" alt="${escapeHtml(alt)}" />`;
  }

  function getRunFormat(rPr: Element | null): RunFormat {
    if (!rPr) return { b: false, i: false, u: false, s: false, va: '' };
    const bNode = qn(rPr, 'b');
    const iNode = qn(rPr, 'i');
    const uNode = qn(rPr, 'u');
    const bVal = bNode ? attr(bNode, 'val') : '';
    const iVal = iNode ? attr(iNode, 'val') : '';
    const uVal = uNode ? attr(uNode, 'val') : '';
    const vAlign = qn(rPr, 'vertAlign');
    return {
      b: !!bNode && bVal !== 'false' && bVal !== '0',
      i: !!iNode && iVal !== 'false' && iVal !== '0',
      u: !!uNode && uVal !== 'none' && uVal !== 'false' && uVal !== '0',
      s: !!qn(rPr, 'strike'),
      va: vAlign ? attr(vAlign, 'val') || '' : '',
    };
  }

  function formatKey(fmt: RunFormat): string {
    return `${fmt.b ? 'B' : ''}${fmt.i ? 'I' : ''}${fmt.u ? 'U' : ''}${fmt.s ? 'S' : ''}${fmt.va}`;
  }

  function wrapFormat(text: string, fmt: RunFormat): string {
    let html = text;
    if (fmt.b) html = `<strong>${html}</strong>`;
    if (fmt.i) html = `<em>${html}</em>`;
    if (fmt.u) html = `<u>${html}</u>`;
    if (fmt.s) html = `<s>${html}</s>`;
    if (fmt.va === 'superscript') html = `<sup>${html}</sup>`;
    else if (fmt.va === 'subscript') html = `<sub>${html}</sub>`;
    return html;
  }

  async function processParagraphContent(paragraph: Element): Promise<string> {
    const segments: Segment[] = [];
    let fieldInstr = '';
    let fieldResult = '';
    let inField = false;
    let collectingFieldResult = false;
    let fieldDepth = 0;

    for (let child = paragraph.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;

      if (el.localName === 'hyperlink') {
        const rId = el.getAttribute('r:id') || attr(el, 'id');
        const href = rels[rId] || '';
        let label = '';
        for (let linkChild = el.firstChild; linkChild; linkChild = linkChild.nextSibling) {
          if (linkChild.nodeType === Node.ELEMENT_NODE && (linkChild as Element).localName === 'r') {
            label += getRunText(linkChild as Element);
          }
        }
        segments.push({ raw: href ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : escapeHtml(label) });
        continue;
      }

      if (el.localName === 'oMath') {
        const latex = ommlToLatex(el);
        if (latex) segments.push({ raw: `<span class="math-inline" data-tex="${escapeHtml(latex)}">\\(${escapeHtml(latex)}\\)</span>` });
        continue;
      }

      if (el.localName === 'sdt') {
        const content = qn(el, 'sdtContent');
        if (content) {
          for (const innerParagraph of qnAll(content, 'p')) {
            const innerHtml = await processParagraphContent(innerParagraph);
            if (innerHtml) segments.push({ raw: innerHtml });
          }
        }
        continue;
      }

      if (el.localName !== 'r') continue;

      const fldChar = qn(el, 'fldChar');
      if (fldChar) {
        const type = attr(fldChar, 'fldCharType');
        if (type === 'begin') {
          inField = true;
          collectingFieldResult = false;
          fieldDepth++;
          fieldInstr = '';
          fieldResult = '';
        } else if (type === 'separate') {
          collectingFieldResult = true;
        } else if (type === 'end') {
          fieldDepth--;
          if (fieldDepth <= 0) {
            const raw = processField(fieldInstr, fieldResult);
            if (raw) segments.push({ raw });
            inField = false;
            collectingFieldResult = false;
          }
        }
        continue;
      }

      const instrText = qn(el, 'instrText');
      if (instrText) {
        fieldInstr += instrText.textContent ?? '';
        continue;
      }
      if (inField) {
        if (collectingFieldResult) fieldResult += getRunText(el);
        continue;
      }

      const text = getRunText(el);
      if (!text) {
        const drawing = qn(el, 'drawing');
        if (drawing) {
          const imageHtml = await processDrawing(drawing);
          if (imageHtml) segments.push({ raw: imageHtml });
        }
        continue;
      }

      segments.push({ text: escapeHtml(text), fmt: getRunFormat(qn(el, 'rPr')) });
    }

    let html = '';
    let index = 0;
    while (index < segments.length) {
      const segment = segments[index];
      if (isRawSegment(segment)) {
        html += segment.raw;
        index++;
        continue;
      }

      let merged = segment.text;
      const key = formatKey(segment.fmt);
      let next = index + 1;
      while (next < segments.length && !isRawSegment(segments[next])) {
        const textSegment = segments[next] as TextSegment;
        if (formatKey(textSegment.fmt) !== key) break;
        merged += textSegment.text;
        next++;
      }
      html += wrapFormat(merged, segment.fmt);
      index = next;
    }
    return html;
  }

  async function processTable(table: Element): Promise<string> {
    let html = '<table>';
    const rows = qnAll(table, 'tr');

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      html += '<tr>';
      const cells = qnAll(rows[rowIndex], 'tc');
      let colIndex = 0;

      for (const cell of cells) {
        const tcPr = qn(cell, 'tcPr');
        const gridSpan = qn(tcPr, 'gridSpan');
        const colspan = gridSpan ? Number.parseInt(attr(gridSpan, 'val') || '1', 10) : 1;
        const vMerge = qn(tcPr, 'vMerge');
        const vMergeValue = vMerge ? attr(vMerge, 'val') || 'continue' : '';

        if (vMergeValue === 'continue') {
          colIndex += colspan;
          continue;
        }

        let rowspan = 1;
        if (vMerge && (vMergeValue === 'restart' || vMergeValue === '')) {
          for (let futureRowIndex = rowIndex + 1; futureRowIndex < rows.length; futureRowIndex++) {
            const futureCells = qnAll(rows[futureRowIndex], 'tc');
            let futureColIndex = 0;
            let found = false;
            for (const futureCell of futureCells) {
              if (futureColIndex === colIndex) {
                const futureVMerge = qn(qn(futureCell, 'tcPr'), 'vMerge');
                if (futureVMerge && (attr(futureVMerge, 'val') || 'continue') === 'continue') {
                  rowspan++;
                  found = true;
                }
                break;
              }
              const futureGridSpan = qn(qn(futureCell, 'tcPr'), 'gridSpan');
              futureColIndex += futureGridSpan ? Number.parseInt(attr(futureGridSpan, 'val') || '1', 10) : 1;
            }
            if (!found) break;
          }
        }

        let cellHtml = '';
        const paragraphs = qnAll(cell, 'p');
        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i];
          const pPr = qn(paragraph, 'pPr');
          const numPr = qn(pPr, 'numPr');
          let paragraphHtml = await processParagraphContent(paragraph);
          if (numPr) {
            const numId = attr(qn(numPr, 'numId'), 'val');
            const ilvl = Number.parseInt(attr(qn(numPr, 'ilvl'), 'val') || '0', 10);
            if (numId && numId !== '0') {
              const prefix = resolveNumbering(numId, ilvl);
              paragraphHtml = prefix === '\0BULLET' ? `\u2022 ${paragraphHtml}` : prefix ? `${prefix} ${paragraphHtml}` : paragraphHtml;
            }
          }
          if (i > 0) cellHtml += '<br/>';
          cellHtml += paragraphHtml;
        }

        const tag = rowIndex === 0 ? 'th' : 'td';
        let attrs = '';
        if (colspan > 1) attrs += ` colspan="${colspan}"`;
        if (rowspan > 1) attrs += ` rowspan="${rowspan}"`;
        html += `<${tag}${attrs}>${cellHtml}</${tag}>`;
        colIndex += colspan;
      }
      html += '</tr>';
    }
    return `${html}</table>`;
  }

  async function processParagraph(paragraph: Element): Promise<string> {
    const pPr = qn(paragraph, 'pPr');
    const pStyle = attr(qn(pPr, 'pStyle'), 'val');
    const headingLevel = getHeadingLevel(pStyle, pPr);

    const mathParas = qnDeep(paragraph, 'oMathPara');
    if (mathParas.length > 0) {
      let html = '';
      mathParas.forEach((mathPara) => {
        qnAll(mathPara, 'oMath').forEach((math) => {
          const latex = ommlToLatex(math);
          if (latex) html += `<div class="math-block" data-tex="${escapeHtml(latex)}">\\[${escapeHtml(latex)}\\]</div>`;
        });
      });
      return html;
    }

    const directMath = qnAll(paragraph, 'oMath');
    if (directMath.length === 1) {
      const hasText = qnAll(paragraph, 'r').some((run) => getRunText(run).trim());
      if (!hasText) {
        const latex = ommlToLatex(directMath[0]);
        if (latex) return `<div class="math-block" data-tex="${escapeHtml(latex)}">\\[${escapeHtml(latex)}\\]</div>`;
      }
    }

    const content = await processParagraphContent(paragraph);
    if (!content.trim()) return '';

    const numPr = qn(pPr, 'numPr');
    let numId = numPr ? attr(qn(numPr, 'numId'), 'val') : '';
    let ilvl = numPr ? Number.parseInt(attr(qn(numPr, 'ilvl'), 'val') || '0', 10) : 0;

    if ((!numId || numId === '0') && pStyle && styleNumIds[pStyle]) {
      numId = styleNumIds[pStyle].numId;
      ilvl = Number.parseInt(styleNumIds[pStyle].ilvl || '0', 10);
    }

    if (headingLevel > 0) {
      let prefix = '';
      if (numId && numId !== '0' && !isTocHeading(content.replace(/<[^>]*>/g, ''))) {
        const resolved = resolveNumbering(numId, ilvl);
        if (resolved && resolved !== '\0BULLET') prefix = `${resolved} `;
      }
      return `<h${headingLevel}>${prefix}${content}</h${headingLevel}>`;
    }

    if (numId && numId !== '0') {
      const prefix = resolveNumbering(numId, ilvl);
      if (prefix === '\0BULLET') return `<ul><li>${content}</li></ul>`;
      if (prefix) return `<p>${prefix} ${content}</p>`;
    }
    return `<p>${content}</p>`;
  }

  async function processBlock(block: Element): Promise<string> {
    if (block.localName === 'tbl') return processTable(block);
    if (block.localName === 'p') return processParagraph(block);
    if (block.localName === 'sdt') {
      const content = qn(block, 'sdtContent');
      if (!content) return '';
      let html = '';
      for (const child of Array.from(content.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) html += await processBlock(child as Element);
      }
      return html;
    }
    return '';
  }

  let output = '';
  for (const child of Array.from(body.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) output += await processBlock(child as Element);
  }
  return output;
}
