// 设计验收 R3（zhihu）：设置页用 ui-v2 tokens、--error #b42318、悬浮球单焦点环与 700/14 字形、行内时间 12px、Z2-01 气泡 border-box
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('options/options.html');
const opt = read('options/options.css');
const shared = read('lib/shared.css');
const content = read('content/content.css');
const popup = read('popup/popup.css');

assert.match(html, /<html[^>]*data-brand="zhihu"/);
assert.ok(html.indexOf('../lib/shared.css') > 0 && html.indexOf('../lib/ui-v2.css') > html.indexOf('../lib/shared.css'), 'ui-v2.css 在 shared.css 之后引入，同名 token 以 v2 为准');
for (const [k, v] of [['--bg-card', 'surface'], ['--text-primary', 'text'], ['--accent', 'brand'], ['--focus-ring', 'focus'], ['--border-subtle', 'border']]) {
  assert.match(opt, new RegExp(`${k}: var\\(--${v}\\);`), k);
}
for (const hex of ['#f0f9ff', '#0c4a6e', '#0f172a']) assert.ok(![html, opt].some((s) => s.toLowerCase().includes(hex)), hex);
assert.match(shared, /--error: #b42318;/);
assert.ok(!shared.includes('#c62828'));
const fv = content.match(/#zhihu-md-floating-ball:focus-visible \{([^}]*)\}/)[1];
assert.match(fv, /outline: 2px solid var\(--focus-ring\);/);
assert.ok(!/box-shadow/.test(fv), 'L-07：聚焦不叠加投影');
assert.match(fv, /outline-offset: 2px;/);
assert.ok(!/color-mix/.test(fv), '单层焦点环：不再有 color-mix 外圈');
assert.match(content, /font: 700 14px\/1 system-ui, [^;]*"Noto Sans", sans-serif;/);
const err = content.match(/#zhihu-md-floating-ball\.error \.tooltip,\n#zhihu-md-floating-ball\.warning \.tooltip \{([^}]*)\}/)[1];
assert.match(err, /box-sizing: border-box;/);
assert.match(popup, /\.row small \{[^}]*font-size: var\(--fs-xs\)/);
console.log('design-r3 css tests passed');
