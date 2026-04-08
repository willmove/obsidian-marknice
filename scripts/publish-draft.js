#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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

async function getAccessToken(appId, appSecret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.errcode) throw new Error(`getAccessToken failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function uploadThumb(accessToken, imagePath) {
  const boundary = '----OpenClawWechatSkill' + Date.now();
  const file = fs.readFileSync(imagePath);
  const filename = path.basename(imagePath);
  const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`);
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, file, footer]);
  const res = await fetch(`https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=image`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });
  const json = await res.json();
  if (!res.ok || json.errcode) throw new Error(`uploadThumb failed: ${JSON.stringify(json)}`);
  return json.media_id;
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

  const article = {
    title,
    author,
    digest,
    content: html,
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
