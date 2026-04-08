# marknice-wechat

A practical AgentSkill-style project for converting Markdown and Word (`.docx`) documents into WeChat Official Account article formatting, with optional direct publishing to the WeChat draft box.

## Features

- Markdown -> WeChat article HTML
- Word (`.docx`) -> WeChat article HTML
- Multiple themes:
  - `default`
  - `simple`
  - `tech`
  - `elegant`
  - `vivid`
  - `minimal`
  - `amber`
- Output full HTML or fragment-only HTML
- Output JSON conversion summary
- Direct publish to WeChat Official Account draft box
- Cover upload for draft publishing

## Project Structure

```text
marknice-wechat/
├── .env.example
├── .gitignore
├── README.md
├── SKILL.md
├── references/
│   └── sample.md
└── scripts/
    ├── convert.js
    ├── package.json
    ├── publish-draft.js
    ├── publish-from-source.js
    └── test-all.sh
```

## Requirements

- Node.js 18+
- A valid WeChat Official Account `APP_ID` and `APP_SECRET` if using draft publishing

## Install

```bash
cd scripts
npm install
```

## Conversion Usage

### Markdown -> WeChat HTML

```bash
node convert.js \
  --input /path/to/article.md \
  --theme elegant \
  --title "My Article" \
  --output /path/to/output/article-wechat.html
```

### DOCX -> WeChat HTML

```bash
node convert.js \
  --input /path/to/article.docx \
  --theme tech \
  --title "My Article" \
  --output /path/to/output/article-wechat.html
```

### Fragment Mode

```bash
node convert.js \
  --input /path/to/article.md \
  --theme amber \
  --fragment \
  --summary /path/to/output/summary.json \
  --output /path/to/output/article-fragment.html
```

## WeChat Draft Publishing

Create a local `.env` file from `.env.example`:

```env
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

### Publish already-generated HTML to draft box

```bash
node publish-draft.js \
  --env /path/to/.env \
  --html /path/to/article-wechat.html \
  --title "Article Title" \
  --author "Author Name" \
  --digest "Short summary" \
  --thumb /path/to/cover.png
```

### One-shot: source document -> conversion -> draft publish

```bash
node publish-from-source.js \
  --input /path/to/article.md \
  --title "Article Title" \
  --theme elegant \
  --author "Author Name" \
  --digest "Short summary" \
  --thumb /path/to/cover.png \
  --env /path/to/.env
```

## Notes

- `.env` is intentionally ignored and should never be committed.
- Generated HTML/JSON under `references/` is also ignored.
- This project was rebuilt from a deleted local skill/workflow and then extended with direct WeChat draft publishing support.
