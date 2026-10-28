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
