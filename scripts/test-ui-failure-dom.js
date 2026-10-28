// round2 审查：悬浮球与 popup 的失败原因展示 + aria-label 更新（linkedom DOM 测试）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { FAILURE_MESSAGES } from '../lib/failure-reason.js';

const flush = () => new Promise((r) => setImmediate(r));
const SECURITY = FAILURE_MESSAGES.security_check;
assert.ok(SECURITY, 'security_check copy exists');

// 捕获 setTimeout，便于断言“失败不自动复位、成功 4 秒后复位”
const timers = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
const runTimers = () => { while (timers.length) timers.shift().fn(); };

// ---------- 悬浮球 ----------
{
  const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.window = window; globalThis.document = document;
  const { FloatingBall } = await import('../content/modules/floating-ball.js');
  const ball = FloatingBall.createFloatingBall();

  FloatingBall.busy = true;
  const gen = ++FloatingBall.operation;
  FloatingBall.updateBallState(ball, 'loading');
  FloatingBall.finishBall(ball, gen, 'error', SECURITY);

  const label = ball.getAttribute('aria-label');
  assert.ok(label.includes(SECURITY.replace(/[!！。.…\s]+$/u, '')), `aria-label carries reason: ${label}`);
  assert.ok(ball.classList.contains('error'));
  assert.equal(ball.querySelector('.tooltip').textContent, SECURITY);
  const live = document.getElementById('zhihu-md-live');
  assert.equal(live.getAttribute('role'), 'alert');
  assert.equal(live.getAttribute('aria-live'), 'assertive');
  assert.equal(live.textContent, SECURITY);
  assert.equal(timers.length, 0, 'error must not schedule an auto-reset');
  runTimers();
  assert.ok(ball.classList.contains('error'), 'error persists after timers');

  const gen2 = ++FloatingBall.operation;
  FloatingBall.finishBall(ball, gen2, 'success', '导出成功!');
  assert.equal(ball.getAttribute('aria-label'), '导出成功。再次点击可重新导出');
  assert.equal(live.getAttribute('role'), 'status');
  assert.deepEqual(timers.map((t) => t.ms), [4000]);
  runTimers();
  assert.ok(!ball.classList.contains('success') && !ball.classList.contains('error'), 'success resets');
  assert.equal(live.textContent, '');
  console.log('ball failure DOM tests passed');
}

// ---------- popup（Round 3 v2：内联 alert + 主按钮变「重试」 + 最近导出） ----------
{
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8')
    .replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  const sent = [];
  const local = {};
  let dl = { success: false, error: 'never' };
  let exportRes = { success: false, reason: 'security_check', error: 'raw' };
  globalThis.chrome = {
    tabs: {
      query: async () => [{ id: 7, url: 'https://zhuanlan.zhihu.com/p/123' }],
      sendMessage: async (_id, msg) => {
        sent.push(msg.action);
        if (msg.action === 'getArticleInfo') return { success: true, data: { title: 'T', author: 'A' } };
        return exportRes;
      },
      reload() {},
    },
    runtime: { sendMessage: async () => dl, openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '9.9.9' }) },
    commands: { getAll: async () => [{ name: 'export-page', shortcut: 'Alt+Shift+Z' }] },
    downloads: { show(id) { sent.push('show:' + id); } },
    storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => ({ ...d, ...local }), set: async (o) => Object.assign(local, o) } },
  };
  await import('../popup/popup.js');
  for (let i = 0; i < 8; i++) await flush();
  const exportBtn = document.getElementById('export-btn');
  const label = () => exportBtn.querySelector('.label').textContent;
  assert.equal(exportBtn.disabled, false, 'ready after init');
  assert.equal(document.getElementById('article-author').textContent, 'A');
  assert.equal(document.getElementById('footer-version').textContent, 'v9.9.9');
  exportBtn.dispatchEvent(new window.Event('click'));
  for (let i = 0; i < 8; i++) await flush();
  const fb = document.getElementById('action-feedback');
  assert.deepEqual(sent, ['getArticleInfo', 'exportMarkdown']);
  assert.equal(fb.getAttribute('role'), 'alert');
  assert.equal(document.getElementById('feedback-title').textContent, SECURITY.split('：')[0]);
  assert.ok(document.getElementById('feedback-hint').textContent.includes('重试'));
  assert.equal(fb.dataset.reason, 'security_check');
  assert.ok(!fb.classList.contains('hidden'));
  assert.equal(label(), '重试', 'Z3-3: primary becomes retry');
  assert.equal(document.querySelector('#page-status .status-text').textContent, '失败');
  runTimers();
  assert.ok(!fb.classList.contains('hidden'), 'feedback persists');
  assert.equal(local.recentExports[0].ok, false, 'content-side failure recorded by popup');

  // 成功：ok alert 带文件名，打开按钮调 downloads.show
  exportRes = { success: true, data: { filename: 'T-A.md', content: '# T' } };
  dl = { success: true, downloadId: 42, filename: 'T-A.md' };
  exportBtn.dispatchEvent(new window.Event('click'));
  for (let i = 0; i < 8; i++) await flush();
  assert.ok(fb.classList.contains('hidden'), 'error cleared on success');
  assert.equal(document.getElementById('ok-file').textContent, 'T-A.md');
  document.getElementById('open-btn').dispatchEvent(new window.Event('click'));
  assert.ok(sent.includes('show:42'));
  assert.equal(label(), '导出 Markdown');
  assert.equal(local.recentExports.length, 1, 'background records successes, popup does not double-record');
  console.log('popup failure DOM tests passed');
}
globalThis.setTimeout = realSetTimeout;
