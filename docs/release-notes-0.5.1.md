# MarkNice WeChat 0.5.1

First community release of MarkNice WeChat — convert Obsidian notes into polished WeChat Official Account articles.

## Highlights

- **Live preview** panel that renders the active note exactly as it will appear in WeChat, refreshing as you type
- **Phone & desktop preview modes** — phone mode wraps the preview in a 375px device frame to mirror what readers actually see
- **17 themes**, including a Claude-inspired warm-clay style, plus classic blue, magazine serif, geek dark, and more
- **Font size & paragraph spacing tuning** (±6px / −16~+24px) applied consistently to preview, copy, and draft publishing
- **One-click copy** — every style is inlined into `style` attributes, so pasting into the WeChat editor never breaks the layout
- **Publish to draft box** via the official WeChat API: cover and body images (local files, `![[wiki embeds]]`, remote URLs) are uploaded to WeChat hosting automatically
- Handles Obsidian syntax: image embeds, wikilinks (flattened to text), `==highlight==`, callouts, task lists, tables, code blocks

## Install

1. Create `<vault>/.obsidian/plugins/marknice-wechat/`
2. Copy `main.js`, `manifest.json`, `styles.css` from this release into it
3. Enable **MarkNice WeChat** in Obsidian → Settings → Community plugins

## Setup for publishing

Enter your **App ID** and **App Secret** in plugin settings (WeChat MP console → Settings & Development → Basic Configuration). The WeChat API requires your IP to be whitelisted, and the draft/material APIs require a verified account. Frontmatter keys `title`, `author`, `digest`, and `cover` pre-fill the publish dialog.

---

**Full changelog:** https://github.com/willmove/obsidian-marknice/commits/0.5.1
