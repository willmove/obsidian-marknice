---
name: marknice-wechat
description: Convert Markdown and Word (.docx) documents into WeChat public account article formatting HTML using MarkNice-derived rendering and styling.
---

# MarkNice WeChat Skill

Use this skill when the user wants to:
- convert Markdown into WeChat public account formatted HTML
- convert Word `.docx` into WeChat public account formatted HTML
- apply a styled article theme for公众号文章排版
- generate a local HTML output for later copy/paste into WeChat Official Account editor
- directly publish converted content into WeChat Official Account draft box

## Inputs

Accepted input formats:
- `.md`
- `.markdown`
- `.txt`
- `.docx`

## Themes

Available themes:
- `default`
- `simple`
- `tech`
- `elegant`
- `vivid`
- `minimal`
- `amber`

## Runtime

The conversion runtime is in `scripts/convert.js` and depends on:
- `marked`
- `mammoth`
- `jsdom`

Install dependencies with:

```bash
cd /root/.openclaw/workspace/skills/marknice-wechat/scripts
npm install
```

## Usage

```bash
node /root/.openclaw/workspace/skills/marknice-wechat/scripts/convert.js \
  --input /path/to/article.md \
  --theme tech \
  --title "文章标题" \
  --output /path/to/output/article-wechat.html
```

Optional flags:
- `--fragment` only output the article body fragment, useful for direct WeChat editor paste workflows
- `--summary /path/to/summary.json` write JSON conversion summary to file

For docx:

```bash
node /root/.openclaw/workspace/skills/marknice-wechat/scripts/convert.js \
  --input /path/to/article.docx \
  --theme elegant \
  --title "文章标题" \
  --output /path/to/output/article-wechat.html
```

## Output

The script writes a standalone HTML file and prints JSON summary to stdout.
It can also output:
- fragment-only HTML for direct paste workflows
- summary JSON file via `--summary`
- direct WeChat Official Account draft creation via the draft publish script

Example output:

```json
{
  "ok": true,
  "input": "/tmp/a.docx",
  "output": "/tmp/a-wechat.html",
  "format": "docx",
  "theme": "tech",
  "title": "文章标题",
  "size": 12345
}
```

## Publish to WeChat Draft

If `.env` contains valid:
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`

then use:

```bash
node /root/.openclaw/workspace/skills/marknice-wechat/scripts/publish-draft.js \
  --env /root/.openclaw/workspace/skills/marknice-wechat/.env \
  --html /path/to/output/article-wechat.html \
  --title "文章标题" \
  --author "作者名" \
  --digest "摘要" \
  --thumb /path/to/cover.png
```

The script will:
1. fetch `access_token`
2. upload cover image as permanent material
3. create a WeChat draft article
4. print `thumb_media_id` and `media_id`

## Notes

- This skill now supports both local conversion and direct draft publishing.
- The output HTML is styled for WeChat Official Account article editor compatibility.
- If the user wants more themes or stricter Word fidelity, extend `scripts/convert.js` with additional theme presets and parsing rules.
- Source inspiration and prior implementation basis: `/root/.openclaw/workspace/projects/marknice`
