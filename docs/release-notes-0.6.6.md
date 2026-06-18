# MarkNice WeChat 0.6.6

This release adds compact copy/export workflows for the preview toolbar, making the WeChat publishing flow easier to scan and use.

## What's New

- Added **Copy Markdown** for quickly copying the current note's raw Markdown source.
- Added **Save as HTML** for exporting the rendered article as a standalone `.html` file beside the current note.
- Added command palette entries for copying Markdown and saving HTML.

## Improvements

- The preview toolbar is now more compact: primary actions stay visible, while lower-frequency actions are grouped into **Export** and **More** menus.
- Renamed the main rich-text copy action to **Copy to WeChat Official Account** in the UI, making its purpose clearer.
- Renamed draft publishing to **Send WeChat Draft** in the toolbar and command palette.
- Markdown copy prefers the currently open editor contents, so unsaved edits can be copied without first writing the note to disk.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- HTML, Word, PDF, Markdown copy, and WeChat draft publishing use the same conversion pipeline and theme settings as preview.
- PDF export remains desktop-only.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.6`:

- `manifest.json`
- `main.js`
- `styles.css`
