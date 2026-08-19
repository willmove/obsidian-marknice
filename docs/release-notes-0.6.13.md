# MarkNice WeChat 0.6.13

This release adds the Tech Blue theme ported from the MarkNice web version.

## New

- Added the **Tech Blue (科技蓝)** theme, ported from the MarkNice web version (`tech`). It uses a saturated blue heading palette, per-theme inline code colors, and light blue tints for quotes, code blocks, tables, and highlights. The theme is available in both the settings dropdown and the preview panel toolbar.

## Fixes

- Removed the stale `tech → night` theme migration. The `tech` ID was previously used by the old dark theme that was renamed to `night`; since the ID is now reused for Tech Blue, keeping the migration would silently rewrite a saved Tech Blue selection back to Night on the next plugin load.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- The new theme rides the existing token pipeline used by copy-to-WeChat, export, and direct draft publishing.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.13`:

- `manifest.json`
- `main.js`
- `styles.css`
