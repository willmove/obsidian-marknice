---
name: marknice-wechat
description: Convert Markdown, text, or Word (.docx) documents into WeChat Official Account article HTML, apply公众号排版 themes, and optionally publish the result directly into the WeChat Official Account draft box. Use when the task involves WeChat article formatting, Markdown/Docx to 微信公众号 content conversion, styled article HTML generation, or direct draft publishing with APP_ID/APP_SECRET.
---

# MarkNice WeChat Skill

Use this skill to turn source documents into WeChat Official Account article content.

## Execute in this order

1. Determine the source type:
   - Markdown: `.md`, `.markdown`, `.txt`
   - Word: `.docx`
2. Decide the target workflow:
   - conversion only
   - conversion + direct draft publishing
3. Choose a theme:
   - `default`
   - `simple`
   - `tech`
   - `elegant`
   - `vivid`
   - `minimal`
   - `amber`
4. Run the appropriate script.
5. If publishing to WeChat draft box, ensure `.env` contains valid:
   - `WECHAT_APP_ID`
   - `WECHAT_APP_SECRET`
6. If publishing, provide a usable cover image path for `thumb_media_id` upload.

## Runtime

Core scripts:
- `scripts/convert.js`: source document -> WeChat HTML
- `scripts/publish-draft.js`: HTML -> WeChat draft box
- `scripts/publish-from-source.js`: source document -> convert -> publish draft

Runtime dependencies in `scripts/package.json` include:
- `marked`
- `mammoth`
- `jsdom`

Install dependencies with:

```bash
cd /root/.openclaw/workspace/skills/marknice-wechat/scripts
npm install
```

## Conversion only

```bash
node /root/.openclaw/workspace/skills/marknice-wechat/scripts/convert.js \
  --input /path/to/article.md \
  --theme tech \
  --title "文章标题" \
  --output /path/to/output/article-wechat.html
```

Optional flags:
- `--fragment`: output only the article body fragment for manual paste workflows
- `--summary /path/to/summary.json`: write JSON conversion summary

For `.docx`, use the same command with a `.docx` input path.

## Direct draft publishing from generated HTML

```bash
node /root/.openclaw/workspace/skills/marknice-wechat/scripts/publish-draft.js \
  --env /root/.openclaw/workspace/skills/marknice-wechat/.env \
  --html /path/to/output/article-wechat.html \
  --title "文章标题" \
  --author "作者名" \
  --digest "摘要" \
  --thumb /path/to/cover.png
```

This flow will:
1. fetch `access_token`
2. upload the cover image
3. create a WeChat draft article
4. print `thumb_media_id` and `media_id`

## One-shot flow: source document -> draft box

Use this when the user wants the full pipeline in one step:

```bash
node /root/.openclaw/workspace/skills/marknice-wechat/scripts/publish-from-source.js \
  --input /path/to/article.md \
  --title "文章标题" \
  --theme elegant \
  --author "作者名" \
  --digest "摘要" \
  --thumb /path/to/cover.png \
  --env /root/.openclaw/workspace/skills/marknice-wechat/.env
```

## Outputs

The scripts can produce:
- standalone HTML for browser preview or copy/paste
- fragment-only HTML for manual editor workflows
- JSON conversion summaries
- WeChat draft `media_id` and cover `thumb_media_id`

## Notes

- Prefer `convert.js` when the user only wants rendering or preview.
- Prefer `publish-from-source.js` when the user wants direct draft creation.
- The output HTML is styled for WeChat Official Account editor compatibility.
- If the user wants more themes or stricter Word fidelity, extend `scripts/convert.js`.
- Source inspiration and prior implementation basis: `/root/.openclaw/workspace/projects/marknice`
