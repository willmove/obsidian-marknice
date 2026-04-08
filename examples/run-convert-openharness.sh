#!/usr/bin/env bash
set -euo pipefail
cd /root/.openclaw/workspace/skills/marknice-wechat/scripts
npm install >/dev/null 2>&1
node convert.js \
  --input /root/.openclaw/workspace/manuscripts/openharness-article-20260404/article.md \
  --theme tech \
  --title 'OpenHarness Article' \
  --output /var/www/ai-nav/temp/openharness-article-wechat.html \
  --summary /var/www/ai-nav/temp/openharness-article-wechat.json
