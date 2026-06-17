# MarkNice WeChat 0.6.5

This release improves document export workflows for Obsidian desktop users.

## What's New

- Added PDF export from the preview toolbar and command palette.
- PDF export now saves directly beside the current note, matching Word export behavior.
- Duplicate PDF filenames are handled automatically by appending a number.

## Improvements

- Word exports now use more compact table spacing, reducing extra vertical whitespace inside table cells.
- Word table content keeps tighter paragraph, list, and line spacing without changing the WeChat preview or copy output.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- PDF export is desktop-only; mobile keeps the existing unsupported notice.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.5`:

- `manifest.json`
- `main.js`
- `styles.css`
