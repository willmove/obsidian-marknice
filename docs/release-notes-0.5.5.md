# MarkNice WeChat 0.5.5

First desktop and mobile community release of MarkNice WeChat - convert Obsidian notes into polished WeChat Official Account articles, preview them on desktop or phone, copy with formatting intact, and publish directly to the WeChat draft box.

This release supersedes the earlier 0.5.x release drafts and is intended as the stable community baseline for both desktop Obsidian and mobile Obsidian, including Android.

## Highlights

- **Desktop and mobile Obsidian support** - the plugin is no longer desktop-only. On desktop, the preview opens in the side workspace; on mobile, it opens as a normal tab so tapping the plugin action works reliably.
- **Phone and desktop preview modes** - phone mode wraps the article in a 375px device frame to mirror the reader experience, while desktop mode keeps a wider editing-preview layout.
- **Live WeChat-style preview** - the active note is converted into inline-styled WeChat-ready HTML and refreshes as you edit.
- **16 differentiated themes** - including Claude Warm Clay, Classic Blue, Magazine Serif, Health Green, Indigo-Pink Tech, Geek Dark, Night Sky Blue, Sea Salt Cyan, and more.
- **Theme improvements** - refreshed Health Green, Cafe-style Elegant Brown, and Indigo-Pink Tech themes make the theme list easier to scan and more visually distinct.
- **Font size and paragraph spacing tuning** - adjust font size by `+/-6px` and paragraph spacing from `-16` to `+24px`; changes apply consistently to preview, copy, and draft publishing.
- **One-click copy** - desktop browsers that support rich clipboard output receive `text/html` plus `text/plain`; mobile environments that do not support rich clipboard writes fall back gracefully to plain text instead of failing silently.
- **Publish to WeChat draft box** - send articles through the official WeChat API, including automatic cover upload and article-image rewriting for local files, `![[wiki embeds]]`, data URLs, and remote images.
- **Obsidian syntax support** - handles image embeds, wikilinks flattened to text, `==highlight==`, callouts, task lists, tables, code blocks, and inline code.
- **Inline code fix** - inline code now stays on the same line instead of being wrapped in a block-level element.

## Install

1. Create `<vault>/.obsidian/plugins/marknice-wechat/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` from this release into that folder.
3. Enable **MarkNice WeChat** in Obsidian -> Settings -> Community plugins.

## Upgrade Notes

If you installed an earlier 0.5.x build manually, replace all three plugin files: `main.js`, `manifest.json`, and `styles.css`. Then disable and re-enable the plugin, or restart Obsidian, to make sure the latest bundled code is loaded.

Earlier GitHub release pages in the 0.5.x line may be removed after 0.5.5 is published. Use 0.5.5 as the canonical community release.

## Setup for Publishing

Enter your **App ID** and **App Secret** in plugin settings. You can find them in the WeChat MP console under Settings & Development -> Basic Configuration.

The WeChat API requires your current outbound IP to be whitelisted, and the draft/material APIs require a verified WeChat Official Account. Frontmatter keys `title`, `author`, `digest`, and `cover` pre-fill the publish dialog.

---

**Full changelog:** https://github.com/willmove/obsidian-marknice/commits/0.5.5
