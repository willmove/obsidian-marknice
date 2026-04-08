# marknice-wechat

中文 | [English](#english)

一个实用的 AgentSkill 风格项目，用来把 Markdown 和 Word（`.docx`）文档转换成适合微信公众号的文章排版，并支持直接推送到微信公众号草稿箱。

## 功能特性

- Markdown -> 微信公众号文章 HTML
- Word（`.docx`）-> 微信公众号文章 HTML
- 多种主题风格：
  - `default`
  - `simple`
  - `tech`
  - `elegant`
  - `vivid`
  - `minimal`
  - `amber`
- 支持输出完整 HTML 或 fragment 片段
- 支持输出 JSON 转换摘要
- 支持直接发布到微信公众号草稿箱
- 支持自动上传封面图用于草稿发布

## 项目结构

```text
marknice-wechat/
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── SKILL.md
├── examples/
│   ├── artifacts/
│   └── run-*.sh
├── references/
│   └── sample.md
└── scripts/
    ├── convert.js
    ├── package.json
    ├── publish-draft.js
    ├── publish-from-source.js
    └── test-all.sh
```

## 环境要求

- Node.js 18+
- 如果要发布到草稿箱，需要有效的微信公众号 `APP_ID` 和 `APP_SECRET`

## 安装

```bash
cd scripts
npm install
```

## 转换用法

### Markdown -> 微信文章 HTML

```bash
node convert.js \
  --input /path/to/article.md \
  --theme elegant \
  --title "我的文章" \
  --output /path/to/output/article-wechat.html
```

### DOCX -> 微信文章 HTML

```bash
node convert.js \
  --input /path/to/article.docx \
  --theme tech \
  --title "我的文章" \
  --output /path/to/output/article-wechat.html
```

### Fragment 模式

```bash
node convert.js \
  --input /path/to/article.md \
  --theme amber \
  --fragment \
  --summary /path/to/output/summary.json \
  --output /path/to/output/article-fragment.html
```

## 发布到微信公众号草稿箱

先基于 `.env.example` 创建本地 `.env` 文件：

```env
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

### 将已生成的 HTML 发布到草稿箱

```bash
node publish-draft.js \
  --env /path/to/.env \
  --html /path/to/article-wechat.html \
  --title "文章标题" \
  --author "作者名" \
  --digest "文章摘要" \
  --thumb /path/to/cover.png
```

### 一步完成：源文档 -> 转换 -> 发布草稿

```bash
node publish-from-source.js \
  --input /path/to/article.md \
  --title "文章标题" \
  --theme elegant \
  --author "作者名" \
  --digest "文章摘要" \
  --thumb /path/to/cover.png \
  --env /path/to/.env
```

## 说明

- `.env` 已被忽略，不应该提交到仓库。
- `examples/artifacts/` 下生成的 HTML / JSON 会被忽略。
- `references/` 只保留真正的参考输入材料。
- 这个项目最初是从已删除的本地 skill/workflow 重建出来的，后来又扩展了直接发布微信公众号草稿箱的能力。

---

## English

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
├── LICENSE
├── README.md
├── SKILL.md
├── examples/
│   ├── artifacts/
│   └── run-*.sh
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
- Generated HTML/JSON under `examples/artifacts/` is ignored.
- `references/` is kept for actual reference inputs only.
- This project was rebuilt from a deleted local skill/workflow and then extended with direct WeChat draft publishing support.
