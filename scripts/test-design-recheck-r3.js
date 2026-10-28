// 设计复验 R3（zhihu）：N1 限流提示按钮不溢出、S1 设置页阴影用 token、S2 限流文案不重复
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const popup = read('popup/popup.css');
assert.match(popup, /\.alert \{ flex-wrap: wrap; \}/, 'N1：提示框允许换行');
assert.match(popup, /\.alert \.x \{[^}]*max-width: 100%/, 'N1：按钮区不超过整行');
assert.match(popup, /\.alert \.x \.btn \{[^}]*max-width: 100%/, 'N1：按钮本身不超过整行');
const opt = read('options/options.css');
assert.ok(!/rgba\(12,\s*74,\s*110/.test(opt), 'S1：不再有天蓝色调阴影');
assert.match(opt, /box-shadow: var\(--shadow-2\);/, 'S1：用 ui-v2 shadow token');
const js = read('popup/popup.js');
const nr = js.match(/function showNotReady\([^)]*\) \{([\s\S]*?)\n\}/)[1];
assert.ok(!/setExportActionsEnabled\(false, text\)/.test(nr), 'S2：不可导出原因只在提示框里出现一次');
assert.match(nr, /setExportActionsEnabled\(false, '暂不可导出，原因见上方提示'\)/);
console.log('design-recheck-r3 tests passed');
