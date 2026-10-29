// 设计签核 478f6e1 的必须改 / 建议项
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { descText } from './options-desc-text.js';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('popup/popup.html');
// M2：图片失败提示条要被读屏播报
assert.match(html, /<div id="action-info" class="alert info hidden" role="status">/);
// M3：B2 设置说明写全出现的页面，不再写「右下角」
const opt = read('options/options.html');
assert.equal(descText(opt, 'showFloatingBall'), '在知乎首页、关注、热榜、问题、回答和专栏页显示悬浮球：点击下载，右键复制。');
assert.ok(!opt.includes('右下角'));
// 建议 2：信息提示用「i」，和错误的叹号区分
const info = html.slice(html.indexOf('id="action-info"'), html.indexOf('id="info-text"'));
assert.match(info, /<path d="M12 16v-5M12 8v\.5"\/>/);
// 建议 3：悬浮球成功提示有宽度上限并换行
const ccss = read('content/content.css');
assert.match(ccss, /\.success \.tooltip \{\s*white-space: normal;\s*width: max-content;\s*max-width: min\(280px, calc\(100vw - 96px\)\);\s*box-sizing: border-box;/);
//NEXT
console.log('design signoff tests passed');
