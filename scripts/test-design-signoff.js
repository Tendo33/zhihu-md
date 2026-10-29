// 设计签核 478f6e1 的必须改 / 建议项
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('popup/popup.html');
// M2：图片失败提示条要被读屏播报
assert.match(html, /<div id="action-info" class="alert info hidden" role="status">/);
// M3：B2 设置说明写全出现的页面，不再写「右下角」
const opt = read('options/options.html');
assert.match(opt, /在知乎首页、关注、热榜、问题、回答和专栏文章页显示导出悬浮球（点击下载，右键复制）。/);
assert.ok(!opt.includes('右下角'));
//NEXT
console.log('design signoff tests passed');
