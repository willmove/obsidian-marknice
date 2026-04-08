#!/usr/bin/env bash
set -euo pipefail
cd /root/.openclaw/workspace/skills/marknice-wechat/scripts
node publish-draft.js \
  --env /root/.openclaw/workspace/skills/marknice-wechat/.env \
  --html /var/www/ai-nav/temp/openharness-article-wechat-elegant.html \
  --title 'OpenHarness Article' \
  --author 'OpenClaw' \
  --digest 'OpenHarness 文章公众号排版草稿，由 MarkNice WeChat Skill 自动生成。' \
  --thumb /var/www/ai-nav/illustration-style-samples/08-whiteboard.png
