#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';

const THEMES = {
  default: {
    name: 'default',
    bodyFont: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif",
    text: '#2c3e50',
    heading: '#1f2d3d',
    accent: '#2d8cf0',
    quoteBg: '#f7f7f7',
    quoteBorder: '#2d8cf0',
    codeBg: '#f6f8fa',
    hr: '#eaecef'
  },
  simple: {
    name: 'simple',
    bodyFont: "Georgia,'PingFang SC','Microsoft YaHei',serif",
    text: '#333333',
    heading: '#111111',
    accent: '#3f51b5',
    quoteBg: '#fafafa',
    quoteBorder: '#3f51b5',
    codeBg: '#f5f5f5',
    hr: '#dddddd'
  },
  tech: {
    name: 'tech',
    bodyFont: "Inter,'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#dbe7ff',
    heading: '#ffffff',
    accent: '#56b6ff',
    quoteBg: '#111827',
    quoteBorder: '#56b6ff',
    codeBg: '#0f172a',
    hr: '#334155',
    pageBg: '#020617'
  },
  elegant: {
    name: 'elegant',
    bodyFont: "'Times New Roman','PingFang SC','Microsoft YaHei',serif",
    text: '#4a403a',
    heading: '#2d241f',
    accent: '#9c6b4f',
    quoteBg: '#fbf7f3',
    quoteBorder: '#9c6b4f',
    codeBg: '#f8f3ee',
    hr: '#d9c6b8'
  },
  vivid: {
    name: 'vivid',
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#233044',
    heading: '#0f172a',
    accent: '#ff6b6b',
    quoteBg: '#fff4f4',
    quoteBorder: '#ff6b6b',
    codeBg: '#fff8f1',
    hr: '#ffd6d6'
  },
  minimal: {
    name: 'minimal',
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#222222',
    heading: '#111111',
    accent: '#111111',
    quoteBg: '#fafafa',
    quoteBorder: '#111111',
    codeBg: '#f4f4f4',
    hr: '#e5e5e5'
  },
  amber: {
    name: 'amber',
    bodyFont: "'PingFang SC','Microsoft YaHei',sans-serif",
    text: '#4b3621',
    heading: '#2f1b05',
    accent: '#d97706',
    quoteBg: '#fff7ed',
    quoteBorder: '#d97706',
    codeBg: '#fffbeb',
    hr: '#fcd34d'
  }
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const cur = argv[i];
    if (cur.startsWith('--')) {
      const key = cur.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineCode(text, theme) {
  return `<code style="font-family:Menlo,Consolas,monospace;background:${theme.codeBg};padding:2px 6px;border-radius:4px;font-size:0.92em;">${escapeHtml(text)}</code>`;
}

function normalizeMammothHtml(html) {
  return html
    .replace(/<p>\s*<img/gi, '<figure><img')
    .replace(/<\/img>\s*<\/p>/gi, '</img></figure>');
}

function sanitizeForWechat(rawHtml, theme) {
  const dom = new JSDOM(`<body>${normalizeMammothHtml(rawHtml)}</body>`);
  const { document } = dom.window;
  const body = document.body;

  body.querySelectorAll('script,style,link,meta').forEach((el) => el.remove());

  body.querySelectorAll('p').forEach((p) => {
    p.setAttribute('style', `margin:16px 0;line-height:1.9;color:${theme.text};font-size:16px;word-break:break-word;text-align:justify;`);
  });

  body.querySelectorAll('h1').forEach((el) => {
    el.setAttribute('style', `margin:28px 0 18px;padding-left:12px;border-left:4px solid ${theme.accent};font-size:28px;line-height:1.4;color:${theme.heading};font-weight:700;`);
  });
  body.querySelectorAll('h2').forEach((el) => {
    el.setAttribute('style', `margin:24px 0 14px;font-size:24px;line-height:1.45;color:${theme.heading};font-weight:700;`);
  });
  body.querySelectorAll('h3').forEach((el) => {
    el.setAttribute('style', `margin:20px 0 12px;font-size:20px;line-height:1.5;color:${theme.heading};font-weight:700;`);
  });
  body.querySelectorAll('h4,h5,h6').forEach((el) => {
    el.setAttribute('style', `margin:18px 0 10px;font-size:18px;line-height:1.6;color:${theme.heading};font-weight:600;`);
  });

  body.querySelectorAll('blockquote').forEach((el) => {
    el.setAttribute('style', `margin:18px 0;padding:12px 16px;background:${theme.quoteBg};border-left:4px solid ${theme.quoteBorder};color:${theme.text};border-radius:6px;`);
  });

  body.querySelectorAll('ul,ol').forEach((el) => {
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3 && !(node.textContent || '').trim()) {
        node.remove();
      }
    }
    el.querySelectorAll('p').forEach((p) => {
      const parentTag = p.parentElement?.tagName?.toLowerCase();
      if (parentTag === 'li') {
        p.outerHTML = p.innerHTML;
      }
    });
    el.setAttribute('style', `margin:14px 0 14px 1.2em;padding:0;color:${theme.text};line-height:1.9;`);
  });
  body.querySelectorAll('li').forEach((el) => {
    const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (!text && !el.querySelector('img,table,pre,code,blockquote,ul,ol')) {
      el.remove();
      return;
    }
    for (const node of [...el.childNodes]) {
      if (node.nodeType === 3 && !(node.textContent || '').trim()) {
        node.remove();
      }
    }
    el.setAttribute('style', 'margin:6px 0;');
  });

  body.querySelectorAll('pre').forEach((el) => {
    const code = el.textContent || '';
    el.outerHTML = `<pre style="margin:18px 0;padding:14px 16px;overflow:auto;background:${theme.codeBg};border-radius:8px;color:${theme.text};font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.7;">${escapeHtml(code)}</pre>`;
  });

  body.querySelectorAll('code').forEach((el) => {
    if (el.parentElement?.tagName.toLowerCase() === 'pre') return;
    el.outerHTML = inlineCode(el.textContent || '', theme);
  });

  body.querySelectorAll('a').forEach((el) => {
    el.setAttribute('style', `color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.accent};`);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  });

  body.querySelectorAll('img').forEach((el) => {
    const alt = el.getAttribute('alt') || '';
    const src = el.getAttribute('src') || '';
    el.outerHTML = `<figure style="margin:20px 0;text-align:center;"><img src="${src}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;" />${alt ? `<figcaption style="margin-top:8px;color:#888;font-size:13px;">${escapeHtml(alt)}</figcaption>` : ''}</figure>`;
  });

  body.querySelectorAll('table').forEach((el) => {
    el.setAttribute('style', 'width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;display:block;overflow-x:auto;');
  });
  body.querySelectorAll('th').forEach((el) => {
    el.setAttribute('style', `border:1px solid ${theme.hr};padding:8px 10px;background:${theme.quoteBg};font-weight:700;color:${theme.heading};`);
  });
  body.querySelectorAll('td').forEach((el) => {
    el.setAttribute('style', `border:1px solid ${theme.hr};padding:8px 10px;color:${theme.text};`);
  });

  body.querySelectorAll('hr').forEach((el) => {
    el.outerHTML = `<hr style="border:none;border-top:1px solid ${theme.hr};margin:28px 0;" />`;
  });

  return body.innerHTML.trim();
}

function wrapWechatHtml(innerHtml, { title, themeName, fragment = false }) {
  const theme = THEMES[themeName] || THEMES.default;
  const bg = theme.pageBg || '#ffffff';
  const titleHtml = title
    ? `<h1 style="margin:0 0 24px;padding-left:12px;border-left:4px solid ${theme.accent};font-size:30px;line-height:1.4;color:${theme.heading};font-weight:700;">${escapeHtml(title)}</h1>`
    : '';
  const content = `${titleHtml}${innerHtml}`;
  if (fragment) return content;
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${escapeHtml(title || '微信公众号文章')}</title>\n</head>\n<body style="margin:0;padding:0;background:${bg};font-family:${theme.bodyFont};">\n  <section style="max-width:760px;margin:0 auto;padding:28px 20px;box-sizing:border-box;">\n    ${content}\n  </section>\n</body>\n</html>`;
}

async function docxToHtml(filePath) {
  const result = await mammoth.convertToHtml({ path: filePath }, {
    convertImage: mammoth.images.inline(async (element) => ({
      src: `data:${element.contentType};base64,${(await element.read('base64'))}`
    }))
  });
  return { html: result.value, messages: result.messages || [] };
}

function markdownToHtml(markdown) {
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(markdown);
}

async function readInput(inputPath, format) {
  if (format === 'docx') return await docxToHtml(inputPath);
  const content = fs.readFileSync(inputPath, 'utf8');
  return { html: markdownToHtml(content), messages: [] };
}

async function main() {
  const args = parseArgs(process.argv);
  const input = args.input;
  const output = args.output;
  const themeName = args.theme || 'default';
  const title = args.title || '';
  const fragment = Boolean(args.fragment);
  const summaryFile = args.summary || '';
  let format = args.format || '';

  if (!input) {
    console.error('Missing --input');
    process.exit(1);
  }
  if (!output) {
    console.error('Missing --output');
    process.exit(1);
  }
  if (!format) {
    const ext = path.extname(input).toLowerCase();
    if (ext === '.docx') format = 'docx';
    else format = 'markdown';
  }
  if (!THEMES[themeName]) {
    console.error(`Unknown theme: ${themeName}`);
    console.error(`Available themes: ${Object.keys(THEMES).join(', ')}`);
    process.exit(1);
  }

  const { html: rawHtml, messages } = await readInput(input, format);
  const sanitized = sanitizeForWechat(rawHtml, THEMES[themeName]);
  const finalHtml = wrapWechatHtml(sanitized, { title, themeName, fragment });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, finalHtml, 'utf8');

  const summary = {
    ok: true,
    input,
    output,
    format,
    theme: themeName,
    title: title || null,
    fragment,
    size: finalHtml.length,
    warnings: messages
  };
  if (summaryFile) {
    fs.mkdirSync(path.dirname(summaryFile), { recursive: true });
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
