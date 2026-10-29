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
// 2. 所有提示进 #status-zone，紧跟 #action-hint、在 .acts 之后；空状态区不占位
{
  const zone = document.getElementById('status-zone');
  assert.ok(zone, '#status-zone 存在');
  assert.ok(zone.classList.contains('status-zone'));
  assert.equal(document.getElementById('action-hint').nextElementSibling, zone, '#status-zone 紧跟在 #action-hint 后');
  const acts = document.querySelector('.acts');
  assert.ok(acts.compareDocumentPosition(zone) & 4, '#status-zone 在按钮行之后');
  for (const id of ['action-feedback', 'action-ok', 'action-info']) {
    assert.equal(document.getElementById(id).parentElement, zone, `#${id} 直接在 #status-zone 里`);
  }
  assert.equal(document.getElementById('action-feedback').getAttribute('role'), 'alert', '红色失败仍是 role=alert');
  assert.equal(document.querySelectorAll('[aria-live]').length, 1, '只有 #page-status 一个 aria-live');
  assert.ok(document.getElementById('page-status').hasAttribute('aria-live'));
  assert.match(rule('.status-zone'), /display:flex/); assert.match(rule('.status-zone'), /flex-direction:column/);
  assert.match(rule('.status-zone'), /gap:8px/);
  assert.match(css, /\.status-zone:not\(:has\(> :not\(\.hidden\)\)\)\{display:none\}/, '全隐藏时状态区不占位');
}
console.log('popup r05 tests passed');
