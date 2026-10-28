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

// ---------- popup ----------
{
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8')
    .replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  const sent = [];
  globalThis.chrome = {
    tabs: {
      query: async () => [{ id: 7, url: 'https://zhuanlan.zhihu.com/p/123' }],
      sendMessage: async (_id, msg) => {
        sent.push(msg.action);
        if (msg.action === 'getArticleInfo') return { success: true, data: { title: 'T', author: 'A' } };
        return { success: false, reason: 'security_check', error: 'raw' };
      },
      reload() {},
    },
    runtime: { sendMessage: async () => ({}), openOptionsPage() {}, getURL: (p) => p },
    storage: { sync: { get: (d, cb) => cb(d) } },
  };
  await import('../popup/popup.js');
  for (let i = 0; i < 5; i++) await flush();
  const exportBtn = document.getElementById('export-btn');
  assert.equal(exportBtn.disabled, false, 'ready after init');
  // 设计建议 6：作者写进 span，不冲掉图标
  assert.equal(document.querySelector('#article-author span').textContent, 'A');
  assert.ok(document.querySelector('#article-author svg'), 'author icon kept');
  exportBtn.dispatchEvent(new window.Event('click'));
  for (let i = 0; i < 5; i++) await flush();
  const fb = document.getElementById('action-feedback');
  assert.deepEqual(sent, ['getArticleInfo', 'exportMarkdown']);
  assert.equal(fb.textContent, SECURITY);
  assert.equal(fb.dataset.reason, 'security_check');
  assert.ok(!fb.classList.contains('hidden'));
  assert.equal(exportBtn.querySelector('span').textContent, '导出失败');
  runTimers(); // 2 秒后按钮恢复，但失败原因保留
  assert.equal(exportBtn.querySelector('span').textContent, '导出 Markdown');
  assert.equal(fb.textContent, SECURITY, 'feedback persists after button reset');
  console.log('popup failure DOM tests passed');
}
globalThis.setTimeout = realSetTimeout;
