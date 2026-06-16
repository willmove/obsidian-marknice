import htmlDocx from 'html-docx-js/dist/html-docx';
import { parseDocx } from './docx-parser';
import { htmlToMarkdown } from './html-to-markdown';
import { rewriteMathForWord } from './math';

const WORD_CONTENT_MAX_WIDTH_PX = 560;

function escapeHtml(str = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStyleValue(style: string, prop: string): string {
  const match = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style);
  return match?.[1]?.trim() ?? '';
}

function upsertStyle(style: string, prop: string, value: string): string {
  const pattern = new RegExp(`(^|;)\\s*${prop}\\s*:[^;]*`, 'i');
  if (pattern.test(style)) {
    return style.replace(pattern, `$1${prop}:${value}`);
  }
  return `${style.replace(/;?\s*$/, '')};${prop}:${value}`;
}

function removeStyle(style: string, prop: string): string {
  return style
    .replace(new RegExp(`(^|;)\\s*${prop}\\s*:[^;]*`, 'gi'), '$1')
    .replace(/;{2,}/g, ';')
    .replace(/^;|;$/g, '');
}

function firstSolidColor(cssValue: string, fallback: string): string {
  const hex = cssValue.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) return hex[0];
  const rgb = cssValue.match(/rgba?\([^)]+\)/i);
  return rgb?.[0] ?? fallback;
}

function normalizeGradientStylesForWord(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    let style = el.getAttribute('style') ?? '';
    const background = getStyleValue(style, 'background');
    if (/gradient\(/i.test(background)) {
      const textColor = getStyleValue(style, 'color');
      const fallback = /#fff(?:fff)?\b|white/i.test(textColor) ? '#6366f1' : '#ffffff';
      const solid = firstSolidColor(background, fallback);
      style = upsertStyle(style, 'background', solid);
      style = upsertStyle(style, 'background-color', solid);
    }
    style = removeStyle(style, 'background-size');
    style = removeStyle(style, 'box-shadow');
    el.setAttribute('style', style);
  });
}

function bytesFromDataUrl(src: string): Uint8Array | null {
  const match = src.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i);
  if (!match) return null;
  try {
    if (match[2]) {
      const binary = atob(match[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    const decoded = decodeURIComponent(match[3]);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length && i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function textFromDataUrl(src: string): string | null {
  const bytes = bytesFromDataUrl(src);
  if (!bytes) return null;
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    let out = '';
    for (const byte of bytes) out += String.fromCharCode(byte);
    return out;
  }
}

function cssLengthToPx(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)\s*(px|pt|in|cm|mm)?$/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (match[2] || 'px').toLowerCase();
  if (unit === 'pt') return (n * 96) / 72;
  if (unit === 'in') return n * 96;
  if (unit === 'cm') return (n * 96) / 2.54;
  if (unit === 'mm') return (n * 96) / 25.4;
  return n;
}

function svgDimensions(src: string): { width: number; height: number } | null {
  if (!/^data:image\/svg\+xml/i.test(src)) return null;
  const text = textFromDataUrl(src);
  if (!text) return null;

  const width = /<svg\b[^>]*\bwidth=["']?([^"'\s>]+)/i.exec(text)?.[1];
  const height = /<svg\b[^>]*\bheight=["']?([^"'\s>]+)/i.exec(text)?.[1];
  const widthPx = width ? cssLengthToPx(width) : null;
  const heightPx = height ? cssLengthToPx(height) : null;
  if (widthPx && heightPx) {
    return { width: Math.round(widthPx), height: Math.round(heightPx) };
  }

  const viewBox = /<svg\b[^>]*\bviewBox=["']\s*([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s*["']/i.exec(text);
  if (!viewBox) return null;
  const vbWidth = Number.parseFloat(viewBox[3]);
  const vbHeight = Number.parseFloat(viewBox[4]);
  if (!Number.isFinite(vbWidth) || !Number.isFinite(vbHeight) || vbWidth <= 0 || vbHeight <= 0) return null;
  return { width: Math.round(vbWidth), height: Math.round(vbHeight) };
}

function dataImageDimensions(src: string): { width: number; height: number } | null {
  const svg = svgDimensions(src);
  if (svg) return svg;

  const bytes = bytesFromDataUrl(src);
  if (!bytes || bytes.length < 10) return null;

  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52;
  if (png && bytes.length >= 24) {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
  }

  const gif =
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes.length >= 10;
  if (gif) {
    return { width: readUint16LE(bytes, 6), height: readUint16LE(bytes, 8) };
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = readUint16BE(bytes, offset + 2);
      if (length < 2) return null;
      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        return { width: readUint16BE(bytes, offset + 7), height: readUint16BE(bytes, offset + 5) };
      }
      offset += 2 + length;
    }
  }

  const webp = ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP' && bytes.length >= 30;
  if (webp) {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8X') {
      return {
        width: readUint24LE(bytes, 24) + 1,
        height: readUint24LE(bytes, 27) + 1,
      };
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = readUint32LE(bytes, 21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return {
        width: readUint16LE(bytes, 26) & 0x3fff,
        height: readUint16LE(bytes, 28) & 0x3fff,
      };
    }
  }

  return null;
}

function pxToPt(px: number): string {
  return ((px * 72) / 96).toFixed(2).replace(/\.?0+$/, '');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error('Image load timeout')), 8000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Image load failed'));
    };
    image.src = src;
  });
}

async function measureImageForWord(src: string, fallbackDimensions: { width: number; height: number } | null): Promise<{ width: number; height: number } | null> {
  if (fallbackDimensions?.width && fallbackDimensions.height) return fallbackDimensions;
  if (!src) return null;
  try {
    const loaded = await loadImage(src);
    const width = loaded.naturalWidth || loaded.width || 0;
    const height = loaded.naturalHeight || loaded.height || 0;
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return fallbackDimensions;
  }
}

async function constrainImagesForWord(root: ParentNode): Promise<void> {
  for (const img of Array.from(root.querySelectorAll<HTMLImageElement>('img'))) {
    const src = img.getAttribute('src') ?? '';
    const parsedDimensions = dataImageDimensions(src);
    const dimensions = await measureImageForWord(src, parsedDimensions);
    const hasDimensions = !!dimensions && dimensions.width > 0 && dimensions.height > 0;
    const displayWidth = Math.max(
      1,
      Math.min(dimensions?.width ?? WORD_CONTENT_MAX_WIDTH_PX, WORD_CONTENT_MAX_WIDTH_PX)
    );
    const displayHeight = hasDimensions
      ? Math.max(1, Math.round((dimensions.height * displayWidth) / dimensions.width))
      : null;

    const widthPt = pxToPt(displayWidth);
    const heightPt = displayHeight ? pxToPt(displayHeight) : '';
    const scale = hasDimensions ? Math.round((displayWidth / dimensions.width) * 100) : 100;
    let style = [
      `width:${widthPt}pt`,
      displayHeight ? `height:${heightPt}pt` : '',
      `max-width:${pxToPt(WORD_CONTENT_MAX_WIDTH_PX)}pt`,
      'display:block',
      'margin:10px auto',
      'border-radius:0',
      hasDimensions ? `mso-width-percent:${scale * 10}` : '',
      hasDimensions ? `mso-height-percent:${scale * 10}` : '',
    ]
      .filter(Boolean)
      .join(';');
    style = `${style};`;
    img.setAttribute('style', style);
    img.setAttribute('width', String(displayWidth));
    if (displayHeight) img.setAttribute('height', String(displayHeight));
    else img.removeAttribute('height');

    const parent = img.parentElement;
    if (parent && /^(figure|p|div|section)$/i.test(parent.tagName)) {
      let parentStyle = parent.getAttribute('style') ?? '';
      parentStyle = upsertStyle(parentStyle, 'text-align', 'center');
      parentStyle = upsertStyle(parentStyle, 'margin', '14px 0');
      parentStyle = upsertStyle(parentStyle, 'page-break-inside', 'avoid');
      parent.setAttribute('style', parentStyle);
    }
  }
}

async function prepareHtmlForWord(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  normalizeGradientStylesForWord(doc.body);
  // 公式降级为线性可读文本：Word 的 altChunk 不支持 MathML 与 KaTeX 的 CSS 定位，
  // mathml 输出还会因 <annotation> 导致重复，故导出前转成线性文本。
  rewriteMathForWord(doc.body);
  await constrainImagesForWord(doc.body);
  return doc.body.innerHTML;
}

export async function docxArrayBufferToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  const html = await parseDocx(arrayBuffer);
  return htmlToMarkdown(html);
}

export async function createWordDocumentBlob(html: string, title: string): Promise<Blob> {
  const bodyHtml = await prepareHtmlForWord(html);
  const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Export')}</title>
  <style>
    body {
      font-family: "PingFang SC", "Microsoft YaHei", SimHei, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
    }
    h1 { font-size: 24px; margin: 20px 0 10px; font-weight: bold; }
    h2 { font-size: 20px; margin: 18px 0 8px; font-weight: bold; }
    h3 { font-size: 17px; margin: 14px 0 6px; font-weight: bold; }
    h4 { font-size: 15px; margin: 12px 0 6px; font-weight: bold; }
    h5 { font-size: 14px; margin: 10px 0 6px; font-weight: bold; }
    h6 { font-size: 13px; margin: 10px 0 6px; font-weight: bold; }
    p { margin: 8px 0; }
    ul, ol { margin: 10px 0; padding-left: 24px; }
    li { margin: 6px 0; }
    blockquote { margin: 10px 0; padding: 8px 16px; border-left: 4px solid #ddd; background: #f8f8f8; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #ccc; padding: 6px 10px; }
    th { background: #f5f5f5; font-weight: bold; }
    pre { background: #f6f6f6; padding: 12px; border-radius: 4px; white-space: pre-wrap; }
    code { font-family: Consolas, Monaco, "Courier New", monospace; font-size: 13px; }
    img { max-width: ${WORD_CONTENT_MAX_WIDTH_PX}px; display: block; margin: 10px auto; }
    figure { text-align: center; margin: 14px 0; page-break-inside: avoid; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; }
    a { color: #0066cc; text-decoration: underline; }
    .math-block { display: block; text-align: center; margin: 14px 0; }
    .math-inline { display: inline-block; vertical-align: middle; }
    math { font-family: Cambria Math, STIX Two Math, serif; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  return htmlDocx.asBlob(wordHtml);
}
