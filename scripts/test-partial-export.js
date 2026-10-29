// 发版 QA ZR-02：批量导出中途失败 → popup 显示「已导出 N/M 条，部分失败」，不用成功样式
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { partialText, partialHint } from '../lib/partial-export.js';

assert.equal(partialText({ exported: 43, total: 100 }), '已导出 43/100 条，57 条未能加载');
assert.equal(partialHint({ failedPage: 3 }), '第 3 页起加载失败，文件已保存，可稍后重新导出');

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
// 设计 M1：警告样式（不是错误），文件已保存所以同时给「打开」
assert.ok($('action-ok').classList.contains('hidden'), '设计复核 935b5b5：部分导出不再显示绿色「已保存」');
assert.ok(!$('feedback-open').classList.contains('hidden'), '「打开」在琥珀提示里');
const fb = $('action-feedback');
assert.ok(!fb.classList.contains('hidden') && fb.classList.contains('warn') && !fb.classList.contains('err'), '提示框是 warn 样式');
assert.equal(fb.getAttribute('role'), 'status', '警告用 status，不用 alert');
assert.ok($('feedback-icon').querySelector('path').getAttribute('d').startsWith('M12 3 2 20'), '三角形图标');
assert.equal($('feedback-title').textContent, '已导出 43/100 条，57 条未能加载');
assert.equal($('feedback-hint').textContent, '第 3 页起加载失败，文件已保存，可稍后重新导出');
const badge = $('page-status');
assert.equal($('status-text')?.textContent ?? badge.textContent.trim(), '部分导出');
assert.ok(badge && badge.classList.contains('warn') && !badge.classList.contains('err'), '状态徽标为 warn');

// 悬浮球：warning 态 + 「部分导出：」前缀；读屏不出现「失败」
const ball = fs.readFileSync(new URL('../content/modules/floating-ball.js', import.meta.url), 'utf8');
assert.match(ball, /this\.finishBall\(ball, generation, 'warning', t\('ballPartial', exported, total, total - exported\), srExtra, t\('ballPartialSep'\)\)/);
{ const { t } = await import('../content/modules/i18n.js'); const { PARTIAL_PREFIX } = await import('../lib/partial-export.js'); const { PARTIAL_SR_SEP } = await import('../lib/image-pack.js');
  assert.equal(t('ballPartial', 43, 100, 57), PARTIAL_PREFIX + partialText({ exported: 43, total: 100 }), '中文回退与弹窗文案一致'); assert.equal(t('ballPartialSep'), PARTIAL_SR_SEP); }
assert.match(ball, /warning: \(\) => svgIcon\('warn', 'icon'\)/);
const { ballA11y } = await import('../content/modules/ball-a11y.js');
const a = ballA11y('warning', '部分导出：已导出 12/20 条，8 条未能加载');
assert.equal(a.label, '部分导出：已导出 12/20 条，8 条未能加载。再次点击可重新导出');
assert.doesNotMatch(a.label, /失败/);
const css = fs.readFileSync(new URL('../content/content.css', import.meta.url), 'utf8');
assert.match(css, /--warning: #f59e0b;/);
assert.match(css, /--on-warning: #1f1300;/);
assert.match(css, /--warning: #fbbf24;/);
assert.match(css, /\.warning \{\s*background: var\(--warning\);\s*box-shadow: 0 0 0 1px #b45309/);
assert.match(css, /:not\(\.error\):not\(\.warning\) \.tooltip/);
const ui = fs.readFileSync(new URL('../lib/ui-v2.css', import.meta.url), 'utf8');
assert.match(ui, /\.alert\.warn\{background:var\(--warning-bg\);color:var\(--warning\)\}/);
assert.match(ui, /\.badge\.warn\{/);
console.log('partial export tests passed');
