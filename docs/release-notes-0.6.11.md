# MarkNice WeChat 0.6.11

This release fixes an Obsidian community plugin compatibility check while keeping the plugin available for Obsidian `1.5.0` and later.

## Fixes

- Removed usage of the newer `workspace.revealLeaf()` API from preview activation.
- Kept preview opening behavior compatible by expanding the right sidebar on desktop and activating the preview leaf with older supported workspace APIs.
- Resolves the `obsidianmd/no-unsupported-api` community check for the declared `minAppVersion`.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- Existing conversion, copy, export, OCR import, and WeChat draft publishing behavior remains unchanged.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.11`:

- `manifest.json`
- `main.js`
- `styles.css`
