// 设计验收必须改 1 / 审查建议 4：.action-feedback 只用 --error 和 color-mix，浅色、深色文字对比度都 ≥4.5
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shared = fs.readFileSync(new URL('../lib/shared.css', import.meta.url), 'utf8');
const popup = fs.readFileSync(new URL('../popup/popup.css', import.meta.url), 'utf8');
const rule = popup.match(/\.action-feedback\s*\{([^}]*)\}/)[1];
assert.match(rule, /color:\s*var\(--error\)/);
assert.match(rule, /background:\s*color-mix\(in srgb, var\(--error\) 10%, var\(--bg-secondary\)\)/);
assert.match(rule, /border:\s*1px solid color-mix\(in srgb, var\(--error\) 35%, transparent\)/);
assert.ok(!/--zm-danger/.test(popup + shared), 'no undefined --zm-danger-* vars');

const darkStart = shared.indexOf('@media (prefers-color-scheme: dark)');
const blocks = { light: shared.slice(0, darkStart), dark: shared.slice(darkStart) };
const tok = (b, n) => b.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))[1];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => rgb(a).map((v, i) => Math.round(v * p + rgb(b)[i] * (1 - p)));
const lum = (c) => {
  const l = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [name, b] of Object.entries(blocks)) {
  const err = tok(b, 'error'); const bg = tok(b, 'bg-secondary');
  const fill = mix(err, bg, 0.1);
  const r = ratio(rgb(err), fill);
  console.log(`action-feedback ${name}: ${err} on rgb(${fill}) = ${r.toFixed(2)}`);
  assert.ok(r >= 4.5);
  if (name === 'dark') assert.ok(lum(fill) < 0.05, 'dark feedback bg stays dark');
}
console.log('danger token tests passed');
