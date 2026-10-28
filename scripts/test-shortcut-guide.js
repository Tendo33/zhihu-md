// Z3-03：快捷键未设置引导 —— 3 种 UA × 快捷键空/非空（纯函数 + popup DOM）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { shortcutGuide, detectBrowser } from '../lib/shortcut-guide.js';

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
};
const URLS = { chrome: 'chrome://extensions/shortcuts', edge: 'edge://extensions/shortcuts', firefox: null };
const CMD = 'export-page';
const set = [{ name: CMD, shortcut: 'Alt+Shift+K' }];
const empty = [{ name: CMD, shortcut: '' }];

// ---- 纯函数 ----
for (const [b, ua] of Object.entries(UA)) {
  assert.equal(detectBrowser(ua), b);
  assert.deepEqual(shortcutGuide(set, CMD, ua), { set: true, shortcut: 'Alt+Shift+K' }, `${b} 非空`);
  const g = shortcutGuide(empty, CMD, ua, 'zh-CN');
  assert.equal(g.set, false); assert.equal(g.label, '快捷键未设置'); assert.equal(g.url, URLS[b]);
  if (b === 'firefox') { assert.equal(g.button, null); assert.equal(g.hint, '在附加组件管理里设置'); }
  else { assert.equal(g.button, '去设置'); assert.equal(g.hint, null); }
  const e = shortcutGuide(empty, CMD, ua, 'en-US');
  assert.equal(e.label, 'Shortcut not set');
  assert.equal(b === 'firefox' ? e.hint : e.button, b === 'firefox' ? 'Set it in Add-ons Manager' : 'Set up');
}
assert.equal(shortcutGuide([], CMD, UA.chrome).set, false, '命令缺失也视为未设置');
assert.equal(shortcutGuide([{ name: 'other', shortcut: 'Alt+Q' }], CMD, UA.chrome).set, false);

// ---- popup DOM：真实 popup.js 渲染 ----
const flush = () => new Promise((r) => setImmediate(r));
const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
let n = 0;
async function renderPopup(ua, cmds) {
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, language: 'zh-CN', clipboard: {} }, configurable: true });
  const created = [];
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://www.zhihu.com/hot' }], sendMessage: async () => ({ success: false }), create: async (o) => { created.push(o.url); } },
    runtime: { sendMessage: async () => ({}), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '1' }) },
    commands: { getAll: async () => cmds },
    storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => d, set: async () => {} } },
  };
  await import(`../popup/popup.js?case=${++n}`);
  for (let i = 0; i < 8; i++) await flush();
  return { document, created };
}
for (const [b, ua] of Object.entries(UA)) {
  { // 非空：显示 kbd，无引导
    const { document } = await renderPopup(ua, set);
    assert.equal(document.getElementById('shortcut-kbd').textContent, 'Alt+Shift+K');
    assert.ok(!document.getElementById('shortcut-kbd').classList.contains('hidden'));
    assert.ok(document.getElementById('shortcut-guide').classList.contains('hidden'), `${b} 非空不显示引导`);
    assert.equal(document.getElementById('shortcut-setup'), null);
  }
  { // 空：显示引导
    const { document, created } = await renderPopup(ua, empty);
    const box = document.getElementById('shortcut-guide');
    assert.ok(!box.classList.contains('hidden'), `${b} 空时显示引导`);
    assert.ok(document.getElementById('shortcut-kbd').classList.contains('hidden'));
    assert.ok(document.getElementById('shortcut-prefix').classList.contains('hidden'), '未设置时隐藏重复前缀');
    assert.ok(box.textContent.includes('快捷键未设置'));
    const btn = document.getElementById('shortcut-setup');
    if (b === 'firefox') {
      assert.equal(btn, null, 'Firefox 不给按钮');
      assert.ok(box.textContent.includes('在附加组件管理里设置'));
    } else {
      assert.equal(btn.tagName, 'BUTTON'); assert.equal(btn.textContent, '去设置');
      btn.dispatchEvent(new document.defaultView.Event('click'));
      await flush();
      assert.deepEqual(created, [URLS[b]], `${b} 打开 ${URLS[b]}`);
    }
  }
}
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.src.json', import.meta.url), 'utf8'));
assert.ok(!manifest.permissions.includes('tabs'), '不新增 tabs 权限');
console.log('shortcut guide: 3 UA × 空/非空 (pure + DOM) passed');
