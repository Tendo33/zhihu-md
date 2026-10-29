// 设置页重做（设计 2026-10-29 M1–M7）：开关单旋钮、同行居中、嵌入式对话框、页脚保存提示、标题、数字框、文案、层级与语义
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('options/options.css');
const ui = read('lib/ui-v2.css');
const rule = (sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)${esc} \\{([^}]*)\\}`));
  return m ? m[1] : null;
};

// M1：只有一颗旋钮（ui-v2 的 ::after），options.css 不再画 ::before 旋钮
assert.ok(!/\.slider:before/.test(css), 'M1：不再有 .slider:before');
assert.match(rule('.switch .slider::before'), /content: none;/, 'M1：显式关掉 ::before');
assert.match(ui, /\.switch span::after\{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px/, 'ui-v2 旋钮仍在');
{
  const sw = rule('.switch');
  assert.match(sw, /width: 40px;/); assert.match(sw, /height: 24px;/);
  const knob = rule('.switch .slider::after');
  assert.match(knob, /top: 3px;/); assert.match(knob, /left: 3px;/); assert.match(knob, /width: 18px;/); assert.match(knob, /height: 18px;/);
  assert.match(rule('.switch input:checked + .slider::after'), /transform: translateX\(16px\);/);
  assert.match(rule('.switch .slider'), /border: 0;/, '轨道无边框，几何按 40 宽算');
  // 几何：左右两侧都是 3px
  const W = 40, K = 18, P = 3, X = 16;
  assert.equal(P, (24 - K) / 2); assert.equal(W - (P + X + K), 3);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\s*\.switch \.slider::after \{ box-shadow: none; \}/, '深色下旋钮无阴影');
}
console.log('options redesign tests passed');
