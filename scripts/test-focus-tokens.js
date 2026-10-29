// L-07（与 arxiv 0b74f08 一致）：知乎深色 --focus 是 #93c5fd，不再等于 --brand #60a5fa；
// popup / 设置页的焦点环一律走 --focus（options 的 --focus-ring 也指向 --focus），不直接用 --brand，单层 outline、不加 box-shadow。
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const v2 = read('lib/ui-v2.css');
const DARK = [
  '[data-theme=dark][data-brand=zhihu]{--brand:#60a5fa;--brand-hover:#82b8fb;--brand-press:#3b8ef5;--brand-on:#06142b;--brand-soft:#152a47;--brand-text:#7cb2ff;--focus:#93c5fd}',
  ':root[data-brand=zhihu]:not([data-theme=light]){--brand:#60a5fa;--brand-hover:#82b8fb;--brand-press:#3b8ef5;--brand-on:#06142b;--brand-soft:#152a47;--brand-text:#7cb2ff;--focus:#93c5fd}',
];
for (const line of DARK) assert.ok(v2.split('\n').includes(line), `ui-v2.css 应有整行：${line}`);
assert.match(v2, /--focus:var\(--brand\);/, '浅色 --focus 不变');
const css = { 'lib/ui-v2.css': v2, 'popup/popup.css': read('popup/popup.css'), 'options/options.css': read('options/options.css') };
for (const [f, s] of Object.entries(css)) {
  for (const m of s.matchAll(/([^{}]*focus[^{}]*)\{([^}]*)\}/g)) {
    const body = m[2];
    if (!/outline\s*:/.test(body)) continue;
    assert.ok(!/outline\s*:[^;]*var\(--brand/.test(body), `${f} ${m[1].trim()}：焦点环用了 --brand`);
    assert.ok(!/box-shadow\s*:(?!\s*none\s*(;|$))/.test(body), `${f} ${m[1].trim()}：焦点环不加 box-shadow`);
    if (/outline\s*:\s*2px/.test(body)) assert.match(body, /outline\s*:\s*2px solid var\(--focus(-ring)?\)/, `${f} ${m[1].trim()}`);
  }
}
assert.match(css['options/options.css'], /--focus-ring: var\(--focus\);/);
console.log('focus token tests passed');
