// 设计签核 478f6e1 的必须改 / 建议项
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('popup/popup.html');
// M2：图片失败提示条要被读屏播报
assert.match(html, /<div id="action-info" class="alert info hidden" role="status">/);
//NEXT
console.log('design signoff tests passed');
