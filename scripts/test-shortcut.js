// Round 3：快捷键 export-page → 当前标签页 triggerExport → 悬浮球流程（无需新权限）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.src.json', import.meta.url), 'utf8'));
assert.equal(manifest.commands['export-page'].suggested_key.default, 'Alt+Shift+Z');
assert.ok(!manifest.permissions.includes('commands'), 'commands 不是权限');
assert.equal(manifest.minimum_chrome_version, '111', 'color-mix 需要 Chrome 111+（复审建议 1）');

const L = {}; const sent = [];
const ev = (n) => ({ addListener: (fn) => { L[n] = fn; } });
globalThis.chrome = {
  runtime: { onMessage: ev('msg'), onInstalled: ev('inst'), id: 'me' },
  commands: { onCommand: ev('cmd') },
  tabs: { query: async () => [{ id: 4 }], sendMessage: async (id, m) => { sent.push([id, m.action]); return { success: true }; } },
  downloads: { download: async () => 1 },
  storage: { local: { get: async (d) => d, set: async () => {} }, sync: { get: (d, cb) => cb(d) } },
};
await import('../background/background.js');
assert.equal(typeof L.cmd, 'function', 'onCommand 已注册');
L.cmd('export-page', { id: 9 });
L.cmd('other', { id: 9 });
await new Promise((r) => setTimeout(r, 5));
L.cmd('export-page', undefined); // 没带 tab 时查当前标签页
await new Promise((r) => setTimeout(r, 5));
assert.deepEqual(sent, [[9, 'triggerExport'], [4, 'triggerExport']]);

// content 侧：有悬浮球时复用它
const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
const { FloatingBall } = await import('../content/modules/floating-ball.js');
const calls = [];
FloatingBall.handleBallClick = (ball) => { calls.push(ball); return Promise.resolve(); };
const ball = FloatingBall.createFloatingBall();
ball.id = 'zhihu-md-floating-ball'; document.body.appendChild(ball);
await FloatingBall.exportFromCommand();
assert.equal(calls[0], ball);
ball.remove();
await FloatingBall.exportFromCommand();
assert.ok(calls[1] && calls[1] !== ball, '悬浮球被关掉时用离屏元素跑同一流程');
console.log('shortcut tests passed');
