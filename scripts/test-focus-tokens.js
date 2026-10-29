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
// L-07 悬浮球：深色 --focus-ring #93c5fd（≠ --accent #60a5fa），单层 2px outline、偏移 2px；
// 聚焦规则里不写 box-shadow，收边状态的 :focus-visible 也不并进换投影的规则组
const ct = read('content/content.css');
const darkBall = ct.match(/html\[data-theme="dark"\] #zhihu-md-floating-ball \{([^}]*)\}/)[1];
assert.match(darkBall, /--focus-ring: #93c5fd;/, '悬浮球深色 --focus-ring');
assert.match(darkBall, /--accent: #60a5fa;/);
assert.match(ct, /\n {2}--focus-ring: #0a5fd1;\n/, '浅色 --focus-ring 不变');
const ballFv = ct.match(/#zhihu-md-floating-ball#zhihu-md-floating-ball:focus-visible \{([^}]*)\}/)[1];
assert.match(ballFv, /outline: 2px solid var\(--focus-ring\) !important;/);
assert.match(ballFv, /outline-offset: 2px !important;/);
assert.ok(!/box-shadow/.test(ballFv), '悬浮球聚焦不加 box-shadow');
for (const m of ct.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
  if (/floating-ball[^,{]*:focus-visible(?![^,{]*\.tooltip)/.test(m[1])) assert.ok(!/box-shadow/.test(m[2]), `聚焦规则不改投影：${m[1].trim()}`);
}
console.log('ball focus token tests passed');

// R12（设计师 21:03）：收边球聚焦时离视口边留 offset 2px + 线宽 2px，环四边完整可见；常态收边位置不变
{
  const css = fs.readFileSync(new URL('../content/content.css', import.meta.url), 'utf8');
  assert.match(css, /#zhihu-md-floating-ball\.docked-left:focus-visible,\s*#zhihu-md-floating-ball\.docked-right:focus-visible\s*\{[^}]*transform:\s*translateX\(var\(--ball-edge-gap\)\)/, '聚焦时用 --ball-edge-gap 离边');
  assert.match(css, /#zhihu-md-floating-ball\.docked-left\s*\{\s*--ball-edge-gap:\s*4px/);
  assert.match(css, /#zhihu-md-floating-ball\.docked-right\s*\{\s*--ball-edge-gap:\s*-4px/);
  assert.match(css, /\.docked-left \{\n {2}transform: translateX\(-40%\);/, '常态收边左位置不变');
  assert.match(css, /\.docked-right \{\n {2}transform: translateX\(40%\);[\s\S]*?right: 0 !important;/, '常态收边右位置不变（right:0 即 clientWidth 边）');
}

// ZF-01（P2）：知乎站点样式 `:focus{outline:none !important}` 会盖掉悬浮球的环。
// 球的 outline 必须 !important，且选择器优先级高于知乎的 :focus（0,1,0）和 *:focus；只用单层 outline，不用 box-shadow
{
  const sel = ct.match(/\n([^{}\n]*#zhihu-md-floating-ball[^{}\n]*:focus-visible) \{[^}]*outline: 2px solid var\(--focus-ring\) !important;/);
  assert.ok(sel, 'ZF-01：悬浮球 outline 要 !important');
  const s0 = sel[1].trim();
  assert.equal(s0, 'html body #zhihu-md-floating-ball#zhihu-md-floating-ball:focus-visible');
  const spec = [(s0.match(/#[\w-]+/g) || []).length, (s0.match(/:[\w-]+|\.[\w-]+|\[[^\]]+\]/g) || []).length];
  assert.ok(spec[0] >= 2 && spec[1] >= 1, `ZF-01：优先级 ${spec} 不够`);
  // 不允许任何悬浮球规则把 outline 设成 none/0（会和 !important 打架）
  for (const m of ct.matchAll(/([^{}]*floating-ball[^{}]*)\{([^}]*)\}/g)) assert.ok(!/outline\s*:\s*(none|0)\b/.test(m[2]), `ZF-01：${m[1].trim()} 去掉了 outline`);
}
console.log('ZF-01 ball outline vs zhihu :focus reset passed');
