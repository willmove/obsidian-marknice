# MarkNice WeChat 0.6.12

This release improves WeChat Official Account rendering compatibility and refines the default article layout.

## Fixes

- Prevented text after bold content at the start of list items from being forced onto a new line by the WeChat editor.
- Applied the same inline-boundary compatibility handling to table cells and inline code.
- Normalized Markdown soft wraps inside list items while preserving explicit hard line breaks and code formatting.
- Avoided invalid `p > figure` nesting for standalone images, preventing extra blank lines around images after WeChat imports the HTML.

## Layout

- Reduced default body, list, quote, code, table, and formula font sizes by 1px for a more compact article layout.
- Preserved inline images without introducing unnecessary block wrappers when they appear alongside text.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- Copy-to-WeChat and direct draft publishing use the same compatibility fixes.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.12`:

- `manifest.json`
- `main.js`
- `styles.css`
