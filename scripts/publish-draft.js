#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

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

function loadEnv(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    env[k] = v;
  }
  return env;
}

function mimeFromFilename(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function extFromMime(mime = '') {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}

async function getAccessToken(appId, appSecret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.errcode) throw new Error(`getAccessToken failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function uploadFileMultipart(url, fieldName, filename, mime, buffer) {
  const boundary = '----OpenClawWechatSkill' + Date.now() + Math.random().toString(16).slice(2);
  const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`);
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, buffer, footer]);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });
  const json = await res.json();
  if (!res.ok || json.errcode) throw new Error(`multipart upload failed: ${JSON.stringify(json)}`);
  return json;
}

async function uploadThumb(accessToken, imagePath) {
  const file = fs.readFileSync(imagePath);
  const filename = path.basename(imagePath);
  const mime = mimeFromFilename(filename);
  const json = await uploadFileMultipart(
    `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=image`,
    'media',
    filename,
    mime,
    file
  );
  return json.media_id;
}

async function uploadContentImage(accessToken, imagePath) {
  const file = fs.readFileSync(imagePath);
  const filename = path.basename(imagePath);
  const mime = mimeFromFilename(filename);
  const json = await uploadFileMultipart(
    `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${encodeURIComponent(accessToken)}`,
    'media',
    filename,
    mime,
    file
  );
  return json.url;
}

async function fetchToTempFile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed: ${url} -> ${res.status}`);
  const arr = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const ext = extFromMime(contentType);
  const tempPath = path.join(os.tmpdir(), `wechat-img-${crypto.randomBytes(8).toString('hex')}${ext}`);
  fs.writeFileSync(tempPath, arr);
  return { tempPath, cleanup: () => { try { fs.unlinkSync(tempPath); } catch {} } };
}

async function rewriteContentImages(accessToken, html) {
  const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];
  if (!matches.length) return html;

  let rewritten = html;
  const cache = new Map();

  for (const match of matches) {
    const src = match[1];
    if (!src || cache.has(src)) continue;
    let temp = null;
    try {
      let imagePath = null;
      if (src.startsWith('http://') || src.startsWith('https://')) {
        temp = await fetchToTempFile(src);
        imagePath = temp.tempPath;
      } else if (src.startsWith('data:image/')) {
        const m = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!m) continue;
        const mime = m[1];
        const ext = extFromMime(mime);
        const tempPath = path.join(os.tmpdir(), `wechat-inline-${crypto.randomBytes(8).toString('hex')}${ext}`);
        fs.writeFileSync(tempPath, Buffer.from(m[2], 'base64'));
        temp = { tempPath, cleanup: () => { try { fs.unlinkSync(tempPath); } catch {} } };
        imagePath = tempPath;
      } else {
        const localPath = path.isAbsolute(src) ? src : path.resolve(path.dirname(process.cwd()), src);
        if (fs.existsSync(localPath)) imagePath = localPath;
      }

      if (!imagePath) continue;
      const wechatUrl = await uploadContentImage(accessToken, imagePath);
      cache.set(src, wechatUrl);
    } finally {
      if (temp) temp.cleanup();
    }
  }

  for (const [src, wechatUrl] of cache.entries()) {
    rewritten = rewritten.split(src).join(wechatUrl);
  }
  return rewritten;
}

async function addDraft(accessToken, article) {
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ articles: [article] })
  });
  const json = await res.json();
  if (!res.ok || json.errcode) throw new Error(`addDraft failed: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const args = parseArgs(process.argv);
  const envPath = args.env || path.resolve('/root/.openclaw/workspace/skills/marknice-wechat/.env');
  const htmlPath = args.html;
  const title = args.title;
  const author = args.author || 'OpenClaw';
  const digest = args.digest || '';
  const thumb = args.thumb;

  if (!htmlPath || !title) {
    console.error('Usage: publish-draft.js --html /path/to/file.html --title "Title" [--author "Author"] [--digest "Digest"] [--thumb /path/to/thumb.png] [--env /path/to/.env]');
    process.exit(1);
  }
  if (!thumb) {
    console.error('Missing --thumb');
    process.exit(1);
  }

  const env = loadEnv(envPath);
  const appId = env.WECHAT_APP_ID || process.env.WECHAT_APP_ID;
  const appSecret = env.WECHAT_APP_SECRET || process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) throw new Error('Missing WECHAT_APP_ID / WECHAT_APP_SECRET');

  const html = fs.readFileSync(htmlPath, 'utf8');
  const token = await getAccessToken(appId, appSecret);
  const thumbMediaId = await uploadThumb(token, thumb);
  const rewrittenHtml = await rewriteContentImages(token, html);

  const article = {
    title,
    author,
    digest,
    content: rewrittenHtml,
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0
  };

  const result = await addDraft(token, article);
  console.log(JSON.stringify({ ok: true, title, thumb_media_id: thumbMediaId, media_id: result.media_id }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
