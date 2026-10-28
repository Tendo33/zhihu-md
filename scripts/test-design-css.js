// Round 2 设计验收建议 1-5：开关品牌色、关闭态轨道、单一焦点环、深色阴影、tooltip 窄屏宽度
import assert from 'node:assert/strict';
import fs from 'node:fs';
const opt = fs.readFileSync(new URL('../options/options.css', import.meta.url), 'utf8');
const content = fs.readFileSync(new URL('../content/content.css', import.meta.url), 'utf8');
assert.match(opt, /input:checked \+ \.slider \{\s*background-color: var\(--accent\);[^}]*border-color: var\(--accent\);/);
assert.match(opt, /\.slider \{[^}]*border: 1px solid var\(--text-tertiary\)/);
assert.ok(!/focus-visible \+ \.slider \{\s*box-shadow/.test(opt), 'no double focus ring');
assert.match(opt, /\.switch input:focus-visible \+ \.slider \{ outline: 2px solid var\(--focus-ring\); outline-offset: 2px; \}/);
assert.match(opt, /@media \(prefers-color-scheme: dark\) \{\s*\.container \{ box-shadow: none; \}/);
assert.match(content, /max-width: min\(280px, calc\(100vw - 96px\)\)/);
console.log('design css tests passed');

// Round 3 设计复验：关闭态轨道填充加深，color-mix 解析后实测（对 --bg-card）
{
  const { parseTokens, resolve, over, ratio } = await import('./contrast.js');
  const shared = fs.readFileSync(new URL('../lib/shared.css', import.meta.url), 'utf8');
  const cut = shared.indexOf('@media (prefers-color-scheme: dark)');
  const L = parseTokens(shared.slice(0, cut), (s) => s === ':root');
  const D = { ...L, ...parseTokens(shared.slice(cut, shared.indexOf('@media', cut + 10)), (s) => s === ':root') };
  assert.match(opt, /\.slider \{[^}]*background-color: var\(--switch-off\)/);
  for (const [n, v, min] of [['light', L, 1.5], ['dark', D, 1.3]]) {
    const page = resolve('var(--bg-card)', v);
    const fill = over(resolve('var(--switch-off)', v), page);
    const r = ratio(fill, page);
    assert.ok(r >= min, `${n} switch-off fill ${r.toFixed(2)}`);
    assert.ok(ratio(resolve('var(--text-tertiary)', v), page) >= 3, `${n} border ≥3`);
    console.log(`switch-off ${n}: fill/page ${r.toFixed(2)}, knob/fill ${ratio(resolve('var(--text-tertiary)', v), fill).toFixed(2)}`);
  }
}
