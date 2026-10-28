// round2 审查建议 4：--zm-danger-* 在浅色和深色下都有定义，深色不再用浅红底，文字对比度 ≥4.5
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../lib/shared.css', import.meta.url), 'utf8');
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
assert.ok(darkStart > 0, 'dark block exists');
const light = css.slice(0, darkStart);
const dark = css.slice(darkStart, css.indexOf('}\n}', darkStart));
const pick = (block, name) => {
  const m = block.match(new RegExp(`--zm-danger-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `--zm-danger-${name} defined`);
  return m[1];
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [label, block] of [['light', light], ['dark', dark]]) {
  const r = ratio(pick(block, 'text'), pick(block, 'bg'));
  assert.ok(r >= 4.5, `${label} contrast ${r.toFixed(2)}`);
  console.log(`danger ${label}: ${pick(block, 'text')} on ${pick(block, 'bg')} = ${r.toFixed(2)}`);
}
assert.ok(lum(pick(dark, 'bg')) < 0.05, 'dark danger bg must be dark');
console.log('danger token tests passed');
