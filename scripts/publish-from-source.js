#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

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

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

function main() {
  const args = parseArgs(process.argv);
  const input = args.input;
  const title = args.title;
  const theme = args.theme || 'default';
  const author = args.author || 'OpenClaw';
  const digest = args.digest || '';
  const thumb = args.thumb;
  const envFile = args.env || '/root/.openclaw/workspace/skills/marknice-wechat/.env';

  if (!input || !title || !thumb) {
    console.error('Usage: publish-from-source.js --input /path/to/file.md --title "Title" --thumb /path/to/cover.png [--theme tech] [--author Name] [--digest Text] [--env /path/to/.env]');
    process.exit(1);
  }

  const outputDir = '/root/.openclaw/workspace/skills/marknice-wechat/references';
  fs.mkdirSync(outputDir, { recursive: true });
  const base = path.basename(input, path.extname(input));
  const htmlOut = path.join(outputDir, `${base}-wechat-publish.html`);
  const summaryOut = path.join(outputDir, `${base}-wechat-publish.json`);

  run('node', [
    '/root/.openclaw/workspace/skills/marknice-wechat/scripts/convert.js',
    '--input', input,
    '--theme', theme,
    '--title', title,
    '--output', htmlOut,
    '--summary', summaryOut
  ], '/root/.openclaw/workspace/skills/marknice-wechat/scripts');

  run('node', [
    '/root/.openclaw/workspace/skills/marknice-wechat/scripts/publish-draft.js',
    '--env', envFile,
    '--html', htmlOut,
    '--title', title,
    '--author', author,
    '--digest', digest,
    '--thumb', thumb
  ], '/root/.openclaw/workspace/skills/marknice-wechat/scripts');
}

main();
