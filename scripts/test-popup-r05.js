// 设计 R05（ZX-01）：状态出现时弹窗按钮行位移为 0。静态结构断言；实际位移由 r05 矩阵（Playwright）实测
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const html = read('popup/popup.html'); const css = read('popup/popup.css'); const js = read('popup/popup.js');
const { document } = parseHTML(html);
const rule = (sel) => { const m = css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&')}\\{([^}]*)\\}`, 'g')); return (m || []).join(' '); };

// 1. 进度条：绝对定位到 #article-info 底边，高 3px，直角；文字行隐藏，内容进 aria-valuetext；不再 aria-live
{
  const prog = document.getElementById('progress');
  assert.ok(prog.closest('#article-info'), '#progress 在 #article-info 里');
  assert.equal(prog.getAttribute('aria-live'), null, '#progress 不再 aria-live（播报统一走 #page-status）');
  assert.ok(prog.querySelector('[role=progressbar]'));
  assert.match(rule('#article-info'), /position:relative/);
  assert.match(rule('#article-info'), /overflow:clip|overflow:hidden[^}]*flex:none/);
  assert.match(rule('#progress'), /position:absolute/); assert.match(rule('#progress'), /bottom:0/);
  assert.match(rule('#progress'), /left:0/); assert.match(rule('#progress'), /right:0/);
  assert.match(rule('#progress .l'), /display:none/);
  assert.match(rule('#progress .bar'), /height:3px/); assert.match(rule('#progress .bar'), /border-radius:0/);
  assert.match(js, /setAttribute\('aria-valuetext', text\)/, '进度文字写进 aria-valuetext');
  assert.match(js, /removeAttribute\('aria-valuetext'\)/, '结束时清掉 aria-valuetext');
}
console.log('popup r05 tests passed');
