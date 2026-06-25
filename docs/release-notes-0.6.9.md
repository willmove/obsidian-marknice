# MarkNice WeChat 0.6.9

This release adds a new import workflow for turning PDF and Word document content into clean Markdown inside Obsidian, including OCR support for image-based PDFs.

## What's New

- Added PDF and Word document import entry points for converting external documents into Markdown notes.
- Added PaddleOCR-powered text recognition for scanned or image-heavy PDF content.
- Added cleanup helpers to normalize imported Markdown before it reaches the preview and export pipeline.

## Improvements

- Exposed the import workflow from the plugin UI so document conversion is easier to discover.
- Added OCR-related settings to control the new recognition flow.
- Improved preview handling for imported document content.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- Existing conversion, copy, export, and WeChat draft publishing behavior remains unchanged.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.9`:

- `manifest.json`
- `main.js`
- `styles.css`
