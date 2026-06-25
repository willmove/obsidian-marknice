function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) slashCount++;
  return slashCount % 2 === 1;
}

function looksLikeInlineMath(tex: string): boolean {
  const value = tex.trim();
  if (!value) return false;
  if (/\\[A-Za-z]+/.test(value)) return true;
  if (/[\^_{}=+\-*/<>|]/.test(value)) return true;
  if (/[A-Za-z]\s*\(/.test(value)) return true;
  if (/[A-Za-z0-9]\s*[+\-*/=]\s*[A-Za-z0-9]/.test(value)) return true;
  if (/^[A-Za-z0-9α-ωΑ-Ω]+(?:['′])?$/.test(value)) return true;
  if (/^[A-Za-z0-9()[\].,\s]+$/.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value)) return true;
  return false;
}

function normalizeMathInPlainSegment(segment: string): string {
  let out = '';
  let i = 0;

  while (i < segment.length) {
    if (segment[i] !== '$' || isEscaped(segment, i) || segment[i + 1] === '$') {
      out += segment[i];
      i++;
      continue;
    }

    let end = -1;
    for (let j = i + 1; j < segment.length; j++) {
      if (segment[j] === '\n') break;
      if (segment[j] !== '$' || isEscaped(segment, j) || segment[j + 1] === '$') continue;
      end = j;
      break;
    }

    if (end === -1) {
      out += segment[i];
      i++;
      continue;
    }

    const inner = segment.slice(i + 1, end);
    const trimmed = inner.trim();
    if (inner !== trimmed && looksLikeInlineMath(trimmed)) {
      out += `$${trimmed}$`;
    } else {
      out += segment.slice(i, end + 1);
    }
    i = end + 1;
  }

  return out;
}

function normalizeLineOutsideCodeSpans(line: string): string {
  let out = '';
  let i = 0;

  while (i < line.length) {
    const tickMatch = /^`+/.exec(line.slice(i));
    if (!tickMatch) {
      const nextTick = line.indexOf('`', i);
      const end = nextTick === -1 ? line.length : nextTick;
      out += normalizeMathInPlainSegment(line.slice(i, end));
      i = end;
      continue;
    }

    const fence = tickMatch[0];
    const close = line.indexOf(fence, i + fence.length);
    if (close === -1) {
      out += line.slice(i);
      break;
    }

    out += line.slice(i, close + fence.length);
    i = close + fence.length;
  }

  return out;
}

export function normalizeOcrInlineMath(markdown: string): string {
  const lines = markdown.split(/(\r?\n)/);
  let inFence = false;
  let fenceMarker = '';

  return lines
    .map((part) => {
      if (/^\r?\n$/.test(part)) return part;

      const fenceMatch = /^( {0,3})(`{3,}|~{3,})/.exec(part);
      if (fenceMatch) {
        const marker = fenceMatch[2][0];
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (marker === fenceMarker) {
          inFence = false;
          fenceMarker = '';
        }
        return part;
      }

      return inFence ? part : normalizeLineOutsideCodeSpans(part);
    })
    .join('');
}
