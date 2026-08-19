# MarkNice WeChat 0.6.14

This release fixes WeChat articles clipping the leading digit of two-digit ordered list numbers.

## Fixes

- **Ordered list numbers are no longer clipped on WeChat.** Non-Amber themes reserved the list indent with `margin-left` and `padding:0`, which made native list markers hang outside the `<ol>` box — the WeChat article renderer clipped the leading digit, so `12.` published as `2.`. The indent is now reserved with `padding-left` (the approach proven by mdnice's classic theme), sized by the largest number in each list: single-digit lists keep the original 1.2em look, two-digit lists get 2.09em, three-digit lists 2.71em, with `ol start` and `li value` honored. Unlike mdnice's fixed 25px, the sizing is digit-aware, so 100+ item lists render intact. Lists stay real native `<ol>` elements — renumbering in the WeChat editor keeps working.
- **Unordered lists** switched to the same padding-based indent with an explicit `list-style-type:disc`, removing the same off-the-box clipping risk for bullets.
- **Amber Orange** keeps its designed `1、` text markers; `start`/`value` attributes are now folded into the marker text and stripped afterwards, so lists that do not start at 1 are numbered correctly and cannot double-number.

## Testing

- Added `npm test`: a happy-dom regression suite that runs the real theming pipeline over 10+ item lists, start-at-11 lists, nested lists, unordered lists, and the Amber theme.

## Compatibility

- Minimum Obsidian version: `1.5.0`.
- Applies to all output paths: preview, copy-to-WeChat, and direct draft publishing.

## Release Assets

For Obsidian community plugin distribution, attach these files to the GitHub release tagged `0.6.14`:

- `manifest.json`
- `main.js`
- `styles.css`
