# MarkNice WeChat 0.6.1

Major feature release: **math typesetting**, **Word import/export**, refreshed themes, and two important stability fixes for documents containing formulas.

This release builds on the 0.5.5 desktop-and-mobile baseline. Everything listed under [0.5.5](#whats-in-055-inherited-baseline) below is still included; the sections above it describe what is new or changed in 0.6.x.

## What's New in 0.6.1

### Math formula support (KaTeX)

- **Inline and block math** - render `$E=mc^2$` inline and `$$\int_0^1 x\,dx$$` as centered blocks using KaTeX. MathML output is used for preview and copy so formulas stay crisp and accessible in browsers and the WeChat editor.
- **Theme-aware styling** - block formulas are centered with consistent margins; inline formulas align to surrounding text. Font size and paragraph-spacing tuning apply to formulas too.

### Word import & export

- **Export to Word** - turn the active note into a `.docx` file saved into the vault. Images are constrained to a content-safe width and converted to the correct physical dimensions.
- **Import from Word** - pick a `.docx` file and import it as a Markdown note, preserving headings, paragraphs, lists, tables, and images.
- **Formulas exported as readable linear text** - because Word's HTML import (the `altChunk` path used by `html-docx-js`) does not support MathML or KaTeX's CSS-based positioning, formulas are converted to Unicode-rich linear text on Word export (e.g. `\frac{a+b}{c+d}` → `(a+b)/(c+d)`, `\sqrt{x^2+y^2}` → `√(x²+y²)`). Information stays correct in every Word version.

### Theme enhancements

- **Ribbon headings** - a new heading variant renders titles as a ribbon label with a folded tail for a stronger magazine feel.
- **Page backgrounds** - themes can now carry a full page background (with configurable background size) wrapping the article body.
- **Refreshed themes** - several themes were retuned for clearer contrast and easier scanning of the theme list.

## Fixes in 0.6.1

- **Fixed: documents with math formulas could freeze Obsidian (OOM).** A DOM helper used when injecting KaTeX output called `importNode` (which *copies* nodes) inside a `while (doc.body.firstChild)` loop. Because copied nodes are never removed from the source document, the loop ran forever, duplicating nodes until the renderer ran out of memory. Any document containing a recognized formula (`$...$` or `$$...$$`) triggered this and made the whole app unresponsive. The helper now *moves* nodes with `appendChild`, terminating the loop correctly.
- **Fixed: Word export duplicated and mis-rendered formulas.** KaTeX's MathML output embeds the original TeX inside an `<annotation>` element, and Word's `altChunk` HTML renderer treats both the MathML text and the annotation as visible text, so every formula appeared twice (e.g. `a = b` → `a=ba = b`). Word also cannot reproduce KaTeX's CSS positioning, so fractions and superscripts were reordered or flattened. Formulas are now converted to clean linear text during Word export (see above).

## Upgrade Notes

If you installed an earlier 0.5.x or 0.6.x build manually, replace all three plugin files: `main.js`, `manifest.json`, and `styles.css`. Then disable and re-enable the plugin, or restart Obsidian, to make sure the latest bundled code is loaded.

## Install

1. Create `<vault>/.obsidian/plugins/marknice-wechat/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` from this release into that folder.
3. Enable **MarkNice WeChat** in Obsidian -> Settings -> Community plugins.

## Setup for Publishing

Enter your **App ID** and **App Secret** in plugin settings. You can find them in the WeChat MP console under Settings & Development -> Basic Configuration.

The WeChat API requires your current outbound IP to be whitelisted, and the draft/material APIs require a verified WeChat Official Account. Frontmatter keys `title`, `author`, `digest`, and `cover` pre-fill the publish dialog.

---

## What's in 0.5.5 (inherited baseline)

First desktop and mobile community release of MarkNice WeChat - convert Obsidian notes into polished WeChat Official Account articles, preview them on desktop or phone, copy with formatting intact, and publish directly to the WeChat draft box.

This release supersedes the earlier 0.5.x release drafts and is the stable community baseline for both desktop Obsidian and mobile Obsidian, including Android.

- **Desktop and mobile Obsidian support** - the plugin is no longer desktop-only. On desktop, the preview opens in the side workspace; on mobile, it opens as a normal tab so tapping the plugin action works reliably.
- **Phone and desktop preview modes** - phone mode wraps the article in a 375px device frame to mirror the reader experience, while desktop mode keeps a wider editing-preview layout.
- **Live WeChat-style preview** - the active note is converted into inline-styled WeChat-ready HTML and refreshes as you edit.
- **16 differentiated themes** - including Claude Warm Clay, Classic Blue, Magazine Serif, Minimal Mono, Indigo-Pink Gradient, Geek Dark, Health Green, Night Sky Blue, Sea Salt Cyan, and more.
- **Theme improvements** - refreshed Health Green, Cafe-style Elegant Brown, and Indigo-Pink Gradient themes make the theme list easier to scan and more visually distinct.
- **Font size and paragraph spacing tuning** - adjust font size by `+/-6px` and paragraph spacing from `-16` to `+24px`; changes apply consistently to preview, copy, and draft publishing.
- **One-click copy** - desktop browsers that support rich clipboard output receive `text/html` plus `text/plain`; mobile environments that do not support rich clipboard writes fall back gracefully to plain text instead of failing silently.
- **Publish to WeChat draft box** - send articles through the official WeChat API, including automatic cover upload and article-image rewriting for local files, `![[wiki embeds]]`, data URLs, and remote images.
- **Obsidian syntax support** - handles image embeds, wikilinks flattened to text, `==highlight==`, callouts, task lists, tables, code blocks, and inline code.
- **Inline code fix** - inline code now stays on the same line instead of being wrapped in a block-level element.

---

**Full changelog:** https://github.com/willmove/obsidian-marknice/commits/0.6.1
