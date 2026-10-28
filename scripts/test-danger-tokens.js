// Round 3：ui-v2.css 关键前景/背景对比度（浅色、深色，知乎品牌）。替代 Round 2 的 action-feedback 检查。
// 也测颜色解析器本身，尤其是 color-mix（设计稿 measure.js 算错的地方）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseTokens, resolve, over, ratio } from './contrast.js';

// --- 解析器单测 ---
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.6);
assert.ok(near(resolve('color-mix(in srgb, #ff0000 10%, #ffffff)', {}), [255, 229.5, 229.5, 1]), '10% 红 + 90% 白');
assert.ok(near(resolve('color-mix(in srgb, #000 25%, #fff 75%)', {}), [191.25, 191.25, 191.25, 1]));
assert.ok(near(resolve('color-mix(in srgb, #ff0000 35%, transparent)', {}), [255, 0, 0, 0.35]), '与 transparent 混合只改 alpha，不变暗');
assert.ok(near(resolve('color-mix(in srgb, #000 20%, #fff 20%)', {}), [127.5, 127.5, 127.5, 0.4]), '百分比和 <100% 时 alpha 缩放');
assert.ok(near(resolve('color-mix(in srgb, var(--a) 50%, color-mix(in srgb, #000, #fff))', { '--a': '#fff' }), [191.25, 191.25, 191.25, 1]), '嵌套 + var');
assert.ok(near(resolve('rgb(0 0 0/.05)', {}), [0, 0, 0, 0.05]));

// --- token 对比度 ---
const css = fs.readFileSync(new URL('../lib/ui-v2.css', import.meta.url), 'utf8');
const popup = fs.readFileSync(new URL('../popup/popup.css', import.meta.url), 'utf8');
assert.ok(!/--zm-danger/.test(css + popup), 'no undefined --zm-danger-* vars');
const light = parseTokens(css, (s) => s === ':root' || s === '[data-brand=zhihu]');
const darkCss = css.slice(css.indexOf('@media (prefers-color-scheme:dark)'));
const dark = { ...light, ...parseTokens(darkCss, (s) => s.startsWith(':root')) };
const pairs = [
  ['--text', '--surface'], ['--text-2', '--surface'], ['--text-2', '--surface-2'],
  ['--danger', '--danger-bg'], ['--success', '--success-bg'], ['--warning', '--warning-bg'],
  ['--brand-on', '--brand'], ['--brand-text', '--surface'], ['--brand-text', '--brand-soft'],
];
for (const [name, vars] of Object.entries({ light, dark })) {
  for (const [fg, bg] of pairs) {
    const b = over(resolve(`var(${bg})`, vars), resolve('var(--surface)', vars));
    const r = ratio(over(resolve(`var(${fg})`, vars), b), b);
    assert.ok(r >= 4.5, `${name} ${fg} on ${bg} = ${r.toFixed(2)}`);
  }
  console.log(`ui-v2 contrast ${name}: ${pairs.length} pairs ≥4.5`);
}
assert.notEqual(dark['--brand'], light['--brand'], '深色覆盖了品牌色');
console.log('danger token tests passed');
