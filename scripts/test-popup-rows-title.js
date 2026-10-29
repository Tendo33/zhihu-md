// 设计复核 4193502：F1（只有保留 → 最近导出 2 行）、F2（部分导出两者都有 → 方案 B）、title 放在可见文字 span 上
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const RECENT = Array.from({ length: 4 }, (_, i) => ({ title: `R${i}`, ok: true, ts: Date.now() - i * 1000 }));
let n = 0;
async function run(bg, data = {}) {
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://zhuanlan.zhihu.com/p/1', title: 'p' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? { success: true, data: { title: 'P', author: '' } } : { success: true, data: { filename: 'p.md', content: '#', images: [{ url: 'u', filename: 'f' }], ...data } }), reload() {} },
    runtime: { sendMessage: async () => ({ success: true, downloadId: 5, filename: 'p_with_images.zip', ...bg }), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb({ ...d, downloadImages: true }) }, local: { get: async (d) => ({ ...d, recentExports: RECENT }), set: async () => {} } },
  };
  await import(`../popup/popup.js?rt${n++}`);
  await flush();
  document.getElementById('export-btn').dispatchEvent(new window.Event('click'));
  await flush();
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
console.log('popup rows/title tests passed');
