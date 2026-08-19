/**
 * converter 有序列表回归测试。
 *
 * 背景：原生 <ol> 序号（list-style-position: outside）画在 ol 的 padding 区域。
 * 旧实现用 margin-left:1.2em + padding:0 预留缩进，序号被挤出盒子左缘，
 * 公众号渲染器裁掉溢出部分，两位数序号 "12." 显示为 "2."。
 *
 * 正确做法（与 mdnice 开源版一致）：保留原生序号，缩进改用 padding-left 预留，
 * 且按最大序号位数自适应（位数 * 0.62em + 0.85em，1 位数下限 1.2em 保持原观感）。
 * amber 主题是例外：其设计即「1、」式文本序号 + list-style:none。
 *
 * 运行：npm test
 */
import assert from 'node:assert';
import { Window } from 'happy-dom';
import { parseMarkdownWithMath } from '../src/math';
import { applyThemeStyles } from '../src/converter';
import { getTheme } from '../src/themes';

const win = new Window();
(globalThis as any).document = win.document;
(globalThis as any).DOMParser = win.DOMParser;
(globalThis as any).Node = win.Node;
(globalThis as any).NodeFilter = win.NodeFilter;

function themedLists(markdown: string, themeId = 'claude'): any[] {
  const raw = parseMarkdownWithMath(markdown);
  const doc = new (win.DOMParser as any)().parseFromString(`<body>${raw}</body>`, 'text/html');
  applyThemeStyles(doc.body, getTheme(themeId), 0, 0);
  return Array.from(doc.body.querySelectorAll('ol,ul'));
}

function paddingLeftEm(style: string): number {
  const m = /padding-left:([\d.]+)em/.exec(style ?? '');
  assert.ok(m, `padding-left in em expected, got: ${style}`);
  return Number(m[1]);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

const md12 = 'List:\n\n' + Array.from({ length: 12 }, (_, i) => `${i + 1}. Item ${i + 1}`).join('\n');

test('ol with >=10 items keeps native markers and reserves 2-digit padding', () => {
  const [ol] = themedLists(md12);
  assert.ok(ol, 'ordered list survives theming');
  const style = ol.getAttribute('style') ?? '';
  assert.match(style, /list-style-type:\s*decimal/, 'native decimal markers kept');
  assert.doesNotMatch(style, /list-style:\s*none/, 'must not disable native markers');
  assert.equal(ol.getAttribute('start'), null);
  assert.ok(paddingLeftEm(style) >= 2, 'two-digit numbers need >=2em of marker room');
  const items = Array.from(ol.querySelectorAll(':scope > li'));
  assert.equal(items.length, 12);
  assert.equal((items[11].textContent ?? '').trim(), 'Item 12', 'no injected number text');
});

test('single-digit list keeps compact 1.2em padding', () => {
  const [ol] = themedLists('List:\n\n1. a\n2. b\n3. c');
  assert.equal(paddingLeftEm(ol.getAttribute('style') ?? ''), 1.2);
});

test('ol start attribute preserved and widens padding for 2 digits', () => {
  const md = 'List:\n\n' + Array.from({ length: 3 }, (_, i) => `${i + 11}. Item ${i + 11}`).join('\n');
  const [ol] = themedLists(md);
  assert.equal(ol.getAttribute('start'), '11', 'native numbering keeps start');
  assert.ok(paddingLeftEm(ol.getAttribute('style') ?? '') >= 2);
});

test('nested ol each reserve their own padding', () => {
  const [outer] = themedLists('Nested:\n\n1. outer a\n   1. inner a\n   2. inner b\n2. outer b');
  const style = outer.getAttribute('style') ?? '';
  assert.match(style, /list-style-type:\s*decimal/);
  assert.ok(paddingLeftEm(style) >= 1.2);
  const innerOls = outer.querySelectorAll('ol');
  assert.equal(innerOls.length, 1, 'nested ol preserved');
});

test('ul keeps native bullets with padding room', () => {
  const [ul] = themedLists('Bullets:\n\n- one\n- two');
  const style = ul.getAttribute('style') ?? '';
  assert.match(style, /list-style-type:\s*disc/);
  assert.doesNotMatch(style, /list-style:\s*none/);
  assert.ok(paddingLeftEm(style) >= 1.2, 'bullets also paint in padding, not outside the box');
  assert.equal((ul.querySelector('li').textContent ?? '').trim(), 'one', 'no injected bullet text');
});

test('amber theme keeps its designed CJK text markers', () => {
  const [ol] = themedLists(md12, 'amber');
  assert.match(ol.getAttribute('style') ?? '', /list-style:\s*none/);
  const items = Array.from(ol.querySelectorAll(':scope > li'));
  assert.match((items[11].textContent ?? '').trim(), /^12、/);
});
