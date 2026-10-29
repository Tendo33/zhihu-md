// 发版 QA ZR-02：批量导出中途失败 → popup 显示「已导出 N/M 条，部分失败」，不用成功样式
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { partialText, partialHint } from '../lib/partial-export.js';

assert.equal(partialText({ exported: 43, total: 100 }), '已导出 43/100 条，部分失败');
assert.equal(partialHint({ failedPage: 3 }), '第 3 页回答加载失败，内容不完整，可稍后重新导出');

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const { window, document } = parseHTML(html);
globalThis.window = window; globalThis.document = document;
const local = { recentExports: [] };
const exportRes = { success: true, data: { filename: 'q_多回答.md', content: '#', partial: { exported: 43, total: 100, failedPage: 3 } } };
globalThis.chrome = {
  tabs: { query: async () => [{ id: 1, url: 'https://www.zhihu.com/question/990002', title: 'q' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? { success: true, data: { title: 'Q', author: '' } } : exportRes), reload() {} },
  runtime: { sendMessage: async () => ({ success: true, downloadId: 5, filename: 'q_多回答.md' }), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
  commands: { getAll: async () => [] },
  downloads: { show() {} },
  storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => ({ ...d, ...local }), set: async (o) => Object.assign(local, o) } },
};
await import('../popup/popup.js');
await flush();
document.getElementById('export-btn').dispatchEvent(new window.Event('click'));
await flush();
const $ = (id) => document.getElementById(id);
assert.ok($('action-ok').classList.contains('hidden'), '不显示「已保存」成功框');
assert.ok(!$('action-feedback').classList.contains('hidden'), '显示失败样式提示');
assert.equal($('feedback-title').textContent, '已导出 43/100 条，部分失败');
assert.equal($('feedback-hint').textContent, '第 3 页回答加载失败，内容不完整，可稍后重新导出');
const badge = $('page-status');
assert.equal($('status-text')?.textContent ?? badge.textContent.trim(), '部分失败');
assert.ok(badge && badge.classList.contains('err') && !badge.classList.contains('ok'), '状态徽标为 err');

// 悬浮球：partial 走 error 样式和同一文案
const ball = fs.readFileSync(new URL('../content/modules/floating-ball.js', import.meta.url), 'utf8');
assert.match(ball, /if \(result\.data\.partial\) \{\s*\/\/[^\n]*\n\s*this\.finishBall\(ball, generation, 'error', partialText\(result\.data\.partial\)\);/);
console.log('partial export tests passed');
