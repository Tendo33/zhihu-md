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
  const sr = el.querySelector('.sr-only');
  assert.ok(sr && sr.textContent === '，另有 2 张保留为在线链接', 'F2：保留数在 .sr-only');
  assert.equal(el.textContent.replace(sr.textContent, ''), '1 张图片下载失败，已保留在线链接', 'F2：屏幕上只显示失败句');
  assert.equal(el.getAttribute('title'), '1 张图片下载失败，另有 2 张保留为在线链接', 'F2：title 全句');
  assert.equal($('action-feedback').getAttribute('title'), null, '容器不带 title');
  assert.equal(rows($), 1, '方案①：部分导出 + 失败和保留都有 → 最近导出 1 行');
}
// 部分导出其他情况仍是 2 行
for (const img of [{ failedImages: 1, keptImages: 0 }, { failedImages: 12, keptImages: 0 }]) {
  const $ = await run(img, { partial: { exported: 3, total: 10, failedPage: 2 } });
  assert.equal(rows($), 1, `复审 da941ab：部分导出 ${JSON.stringify(img)}（f>0, k=0）→ 1 行`);
}
for (const img of [{ failedImages: 0, keptImages: 2 }, { failedImages: 0, keptImages: 0 }]) {
  const $ = await run(img, { partial: { exported: 3, total: 10, failedPage: 2 } });
  assert.equal(rows($), 2, `部分导出 ${JSON.stringify(img)} 仍 2 行`);
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
  assert.equal($('info-text').getAttribute('title'), '1 张图片下载失败，另有 2 张保留为在线链接', '先 kept>0：有 title');
  Object.assign(bg, next);
  $('export-btn').dispatchEvent(new globalThis.window.Event('click')); await flush();
  assert.equal($('info-text').getAttribute('title'), null, `再导出 ${JSON.stringify(next)}：#info-text 没有 title`);
}
console.log('popup rows/title tests passed');
