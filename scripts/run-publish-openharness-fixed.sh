#!/usr/bin/env bash
set -euo pipefail
cd /root/.openclaw/workspace/skills/marknice-wechat/scripts
node publish-draft.js \
  --env /root/.openclaw/workspace/skills/marknice-wechat/.env \
  --html /var/www/ai-nav/temp/openharness-article-wechat-elegant-fixed.html \
  --title 'OpenHarness Article Fixed List Rendering' \
  --author 'OpenClaw' \
  --digest '修复公众号列表项空白问题后的 OpenHarness 文章草稿。' \
  --thumb /var/www/ai-nav/illustration-style-samples/08-whiteboard.png
