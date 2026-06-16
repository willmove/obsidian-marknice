function textContent(node: Element): string {
  return (node.textContent ?? '').trim();
}

function mathText(node: Element, open: RegExp, close: RegExp): string {
  const fromAttr = node.getAttribute('data-tex');
  if (fromAttr) return fromAttr.trim();
  return (node.textContent ?? '').replace(open, '').replace(close, '').trim();
}

function tableToMarkdown(table: Element): string {
  const rows = Array.from(table.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr'));
  if (!rows.length) return '';

  let hasMerge = false;
  rows.forEach((row) => {
    row.querySelectorAll('th, td').forEach((cell) => {
      if (
        Number.parseInt(cell.getAttribute('colspan') || '1', 10) > 1 ||
        Number.parseInt(cell.getAttribute('rowspan') || '1', 10) > 1
      ) {
        hasMerge = true;
      }
    });
  });

  if (hasMerge) {
    let html = '<table>\n';
    rows.forEach((row) => {
      html += '<tr>';
      row.querySelectorAll('th, td').forEach((cell) => {
        const tag = cell.tagName.toLowerCase();
        const colspan = cell.getAttribute('colspan');
        const rowspan = cell.getAttribute('rowspan');
        let attrs = '';
        if (colspan && colspan !== '1') attrs += ` colspan="${colspan}"`;
        if (rowspan && rowspan !== '1') attrs += ` rowspan="${rowspan}"`;
        html += `<${tag}${attrs}>${textContent(cell)}</${tag}>`;
      });
      html += '</tr>\n';
    });
    return `${html}</table>\n\n`;
  }

  let markdown = '';
  rows.forEach((row, index) => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    markdown += `| ${cells.map(textContent).join(' | ')} |\n`;
    if (index === 0) markdown += `| ${cells.map(() => '---').join(' | ')} |\n`;
  });
  return `${markdown}\n`;
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(processNode).join('');

    switch (tag) {
      case 'h1':
        return `# ${children.trim()}\n\n`;
      case 'h2':
        return `## ${children.trim()}\n\n`;
      case 'h3':
        return `### ${children.trim()}\n\n`;
      case 'h4':
        return `#### ${children.trim()}\n\n`;
      case 'h5':
        return `##### ${children.trim()}\n\n`;
      case 'h6':
        return `###### ${children.trim()}\n\n`;
      case 'p':
        return `${children.trim()}\n\n`;
      case 'br':
        return '\n';
      case 'strong':
      case 'b':
        return `**${children.trim()}**`;
      case 'em':
      case 'i':
        return `*${children.trim()}*`;
      case 'u':
        return `<u>${children.trim()}</u>`;
      case 's':
      case 'strike':
      case 'del':
        return `~~${children.trim()}~~`;
      case 'sub':
        return `<sub>${children.trim()}</sub>`;
      case 'sup':
        return `<sup>${children.trim()}</sup>`;
      case 'a': {
        const href = el.getAttribute('href') || '';
        const label = children.trim();
        if (!label && !href) return '';
        if (!href) return label;
        return `[${label}](${href})`;
      }
      case 'img': {
        const src = el.getAttribute('src') || '';
        const alt = el.getAttribute('alt') || '';
        return `![${alt}](${src})\n\n`;
      }
      case 'ul':
      case 'ol':
        return `${children}\n`;
      case 'li': {
        const parent = el.parentElement;
        const ordered = parent?.tagName.toLowerCase() === 'ol';
        const index = ordered ? Array.from(parent.children).indexOf(el) + 1 : 0;
        return `${ordered ? `${index}. ` : '- '}${children.trim()}\n`;
      }
      case 'blockquote':
        return `${children
          .trim()
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')}\n\n`;
      case 'pre':
        return `\`\`\`\n${(el.textContent ?? '').trim()}\n\`\`\`\n\n`;
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') return children;
        return `\`${children.trim()}\``;
      case 'hr':
        return '---\n\n';
      case 'table':
        return tableToMarkdown(el);
      case 'span':
        if (el.classList.contains('math-inline')) {
          const tex = mathText(el, /^\\\(/, /\\\)$/);
          return tex ? `$${tex}$` : children;
        }
        return children;
      case 'div':
        if (el.classList.contains('math-block')) {
          const tex = mathText(el, /^\\\[/, /\\\]$/);
          return tex ? `$$\n${tex}\n$$\n\n` : children;
        }
        return children;
      default:
        return children;
    }
  }

  let markdown = processNode(doc.body).replace(/\n{3,}/g, '\n\n');
  for (let i = 0; i < 5; i++) {
    markdown = markdown.replace(/\*\*([^*]+?)\*\*( ?)\*\*([^*]+?)\*\*/g, '**$1$2$3**');
    markdown = markdown.replace(/\*([^*\n]+?)\*( ?)\*([^*\n]+?)\*/g, '*$1$2$3*');
  }
  return `${markdown.trim()}\n`;
}
