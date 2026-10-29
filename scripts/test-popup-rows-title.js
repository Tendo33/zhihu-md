// 设计复核 4193502：F1（只有保留 → 最近导出 2 行）、F2（部分导出两者都有 → 方案 B）、title 放在可见文字 span 上
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const RECENT = Array.from({ length: 4 }, (_, i) => ({ title: `R${i}`, ok: true, ts: Date.now() - i * 1000 }));
let n = 0;
let TITLE = 'P';
async function run(bg, data = {}, { click = true, fail = false, notReady = false } = {}) {
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://zhuanlan.zhihu.com/p/1', title: TITLE }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? (notReady ? { success: false, error: 'x' } : { success: true, data: { title: TITLE, author: '' } }) : { success: true, data: { filename: 'p.md', content: '#', images: [{ url: 'u', filename: 'f' }], ...data } }), reload() {} },
    runtime: { sendMessage: async () => (fail ? { success: false, error: 'x' } : { success: true, downloadId: 5, filename: 'p_with_images.zip', ...bg }), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb({ ...d, downloadImages: true }) }, local: { get: async (d) => ({ ...d, recentExports: RECENT }), set: async () => {} } },
  };
  await import(`../popup/popup.js?rt${n++}`);
  await flush();
  if (click) { document.getElementById('export-btn').dispatchEvent(new window.Event('click')); await flush(); }
  return (id) => document.getElementById(id);
}
const rows = ($) => $('recent-list').children.length;

// F1：只有保留
{
  const $ = await run({ failedImages: 0, keptImages: 2 });
  assert.equal(rows($), 2, 'F1：只有保留时最近导出 2 行');
}
// 对照：没有图片说明时仍是 3 行
{
  const $ = await run({ failedImages: 0, keptImages: 0 });
  assert.equal(rows($), 3, '普通成功仍 3 行');
}
// F2：部分导出，两者都有
{
  const $ = await run({ failedImages: 1, keptImages: 2 }, { partial: { exported: 3, total: 10, failedPage: 2 } });
  const el = $('feedback-img');
  assert.ok(!el.classList.contains('hidden'));
  // PM 定稿 2026-10-29：整句上屏，没有 .sr-only 和 title
  assert.equal(el.querySelector('.sr-only'), null, '不再有 .sr-only');
  assert.equal(el.textContent, '1 张图片未能下载，2 张不支持保存，均已保留在线链接', '合并句上屏');
  assert.equal(el.getAttribute('title'), null, '不加 title');
  assert.equal($('action-feedback').getAttribute('title'), null, '容器不带 title');
  assert.equal(rows($), 0, '设计定稿 2026-10-29：部分导出 + 失败和保留都有 → 最近导出 0 行');
  assert.ok($('recent').classList.contains('hidden'), '0 行时整块隐藏');
}
// 部分导出其他情况仍是 2 行
for (const img of [{ failedImages: 1, keptImages: 0 }, { failedImages: 12, keptImages: 0 }, { failedImages: 0, keptImages: 2 }, { failedImages: 0, keptImages: 34 }, { failedImages: 0, keptImages: 0 }]) {
  const $ = await run(img, { partial: { exported: 3, total: 10, failedPage: 2 } });
  assert.equal(rows($), 1, `复审 da941ab：部分导出 ${JSON.stringify(img)}→ 一律 1 行`);
}
// 非部分导出不受影响
for (const [img, want] of [[{ failedImages: 0, keptImages: 0 }, 3], [{ failedImages: 0, keptImages: 2 }, 2], [{ failedImages: 1, keptImages: 0 }, 2], [{ failedImages: 1, keptImages: 2 }, 1], [{ failedImages: 12345, keptImages: 10000 }, 1]]) {
  const $ = await run(img);
  assert.equal(rows($), want, `完整导出 ${JSON.stringify(img)} → ${want} 行`);
}
// 状态卡标题：单行、末尾省略；title 和 textContent 都是完整标题（空闲、成功、部分导出、失败）
{
  const css = fs.readFileSync(new URL('../lib/ui-v2.css', import.meta.url), 'utf8');
  const rule = css.match(/\.ctx \.t\{[^}]*\}/)[0];
  for (const d of ['white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'min-width:0']) assert.ok(rule.includes(d), d);
  assert.ok(!/line-clamp/.test(css), '没有 line-clamp');
  assert.match(css, /\.ctx \.badge\{[^}]*flex:none/, '徽标不被挤压');
  TITLE = '如何评价某某在二〇二六年发布的新一代大模型以及它对整个行业未来十年发展可能产生的深远影响？';
  const cases = [
    ['空闲', [{}, {}, { click: false }]],
    ['成功', [{ failedImages: 0 }]],
    ['部分导出', [{ failedImages: 0 }, { partial: { exported: 3, total: 10, failedPage: 2 } }]],
    ['失败', [{}, {}, { fail: true }]],
    ['不可用（用标签页标题）', [{}, {}, { click: false, notReady: true }]],
  ];
  for (const [name, args] of cases) {
    const $ = await run(...args);
    assert.equal($('article-title').textContent, TITLE, `${name}：textContent 全名`);
    assert.equal($('article-title').getAttribute('title'), TITLE, `${name}：title 全名`);
  }
  TITLE = 'P';
}
// 复审 51f7f33 P3：#info-text 的 title 在下一次导出时要被清掉（hideAlerts 与 kept=0 分支）
for (const next of [{ failedImages: 1, keptImages: 0 }, { failedImages: 0, keptImages: 0 }, { failedImages: 0, keptImages: 2 }]) {
  const bg = { failedImages: 1, keptImages: 2 };
  const $ = await run(bg);
  // PM 定稿 2026-10-29：kept>0 也不再加 title（整句已上屏）；下次导出文字要被换掉
  assert.equal($('info-text').getAttribute('title'), null, '先 kept>0：没有 title');
  assert.equal($('info-text').textContent, '1 张图片未能下载，2 张不支持保存，均已保留在线链接');
  Object.assign(bg, next);
  $('export-btn').dispatchEvent(new globalThis.window.Event('click')); await flush();
  assert.equal($('info-text').getAttribute('title'), null, `再导出 ${JSON.stringify(next)}：#info-text 没有 title`);
  assert.ok($('action-info').classList.contains('hidden') || !$('info-text').textContent.includes('不支持保存'), `再导出 ${JSON.stringify(next)}：合并句被换掉`);
}
console.log('popup rows/title tests passed');
