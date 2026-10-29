// 发版审计 N4：出错 / 未就绪时「最近导出」只显示 2 行，正常时 3 行
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');

async function boot(info, exportRes) {
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  const local = { recentExports: [1, 2, 3, 4].map((i) => ({ ok: true, title: 't' + i, ts: Date.now() })) };
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://www.zhihu.com/question/1/answer/2', title: 'x' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? info : exportRes), reload() {} },
    runtime: { sendMessage: async () => ({}), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => ({ ...d, ...local }), set: async (o) => Object.assign(local, o) } },
  };
  await import(`../popup/popup.js?${Math.random()}`);
  await flush();
  return document;
}
const rows = (d) => d.querySelectorAll('#recent-list .row').length;

const ok = await boot({ success: true, data: { title: 'T', author: 'A' } }, { success: false, error: '知乎安全验证：请完成验证后重试', reason: 'security_check' });
assert.equal(rows(ok), 3, '正常 3 行');
ok.getElementById('export-btn').dispatchEvent(new ok.defaultView.Event('click'));
await flush();
assert.ok(!ok.getElementById('action-feedback').classList.contains('hidden'), '出现失败提示');
assert.equal(rows(ok), 2, '导出失败后 2 行');

const nr = await boot({ success: false, reason: 'not_loaded', error: '页面仍在加载' });
assert.equal(rows(nr), 2, '未就绪 2 行');
console.log('recent rows tests passed');
