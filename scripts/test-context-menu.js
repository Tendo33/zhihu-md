// Round 3 C-3：右键菜单（contextMenus）——菜单项、URL 限定、点击分发、选区转 Markdown、权限只多 contextMenus
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { MENU_ITEMS, PAGE_PATTERNS, LINK_PATTERNS, createMenus, handleMenuClick, isExportableLink, openAndWait, showLinkFailure, LINK_TIMEOUT_TITLE } from '../background/context-menu.js';
import { detectPageTypeFromPathname } from '../lib/page-detector.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.src.json', import.meta.url), 'utf8'));
assert.deepEqual(manifest.permissions, ['activeTab', 'clipboardWrite', 'contextMenus', 'downloads', 'storage'], '只新增 contextMenus');
assert.deepEqual(manifest.host_permissions, ['*://*.zhihu.com/*', 'https://*.zhimg.com/*'], '1.1.10：图床主机权限安装时一次授予');

const created = [];
createMenus({ removeAll: (cb) => cb(), create: (o) => created.push(o) });
assert.deepEqual(created.map((c) => c.id), ['zm-page-export', 'zm-page-copy', 'zm-selection-copy', 'zm-link-export']);
// 审查建议 1/2：页面类 3 项必须带 documentUrlPatterns，链接项必须带 targetUrlPatterns（删掉任何一个都要失败）
for (const id of ['zm-page-export', 'zm-page-copy', 'zm-selection-copy']) {
  const c = created.find((x) => x.id === id);
  assert.deepEqual(c.documentUrlPatterns, PAGE_PATTERNS, id + ' 需限定 documentUrlPatterns');
}
const linkItem = created.find((x) => x.id === 'zm-link-export');
assert.deepEqual(linkItem.targetUrlPatterns, LINK_PATTERNS, '链接项需限定 targetUrlPatterns');
assert.deepEqual(linkItem.contexts, ['link']);

// Chrome match pattern 语义（scheme * = http/https；host 精确；path 通配；不含 #）
const matchPattern = (pattern, url) => {
  const m = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  let u; try { u = new URL(url); } catch { return false; }
  const scheme = u.protocol.slice(0, -1);
  if (!(m[1] === '*' ? ['http', 'https'].includes(scheme) : m[1] === scheme)) return false;
  const host = m[2];
  if (host.startsWith('*.')) { const base = host.slice(2); if (!(u.hostname === base || u.hostname.endsWith('.' + base))) return false; }
  else if (host !== '*' && u.hostname !== host) return false;
  const re = new RegExp('^' + m[3].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return re.test(u.pathname + u.search);
};
const pageHit = (u) => PAGE_PATTERNS.some((p) => matchPattern(p, u));
const linkHit = (u) => LINK_PATTERNS.some((p) => matchPattern(p, u));
const SHOW = ['https://zhuanlan.zhihu.com/p/123', 'https://www.zhihu.com/question/1', 'https://www.zhihu.com/question/1/answer/2',
  'https://www.zhihu.com/question/1?sort=created', 'https://www.zhihu.com/hot', 'https://www.zhihu.com/follow', 'https://www.zhihu.com/'];
const HIDE = ['https://www.zhihu.com/search?q=x', 'https://www.zhihu.com/people/abc',
  'https://www.zhihu.com/topic/1', 'https://example.com/question/1', 'https://www.zhihu.com/hotlist'];
for (const u of SHOW) { assert.ok(pageHit(u), '页面菜单应显示: ' + u); assert.notEqual(detectPageTypeFromPathname(new URL(u).pathname), null, '应是可导出页面: ' + u); }
for (const u of HIDE) assert.ok(!pageHit(u), '页面菜单不应显示: ' + u);
for (const u of ['https://zhuanlan.zhihu.com/p/5', 'https://www.zhihu.com/question/1', 'https://www.zhihu.com/question/1/answer/2']) assert.ok(linkHit(u) && isExportableLink(u), '链接菜单应显示: ' + u);
for (const u of ['https://www.zhihu.com/people/a', 'https://www.zhihu.com/topic/1', 'https://www.zhihu.com/', 'https://www.zhihu.com/search?q=1', 'https://evil.com/question/1']) assert.ok(!linkHit(u), '链接菜单不应显示: ' + u);
assert.equal(MENU_ITEMS.length, 4);
// 主管 2026-10-29：中文菜单统一为「导出本页」「复制本页为 Markdown」
assert.equal(MENU_ITEMS.find((x) => x.id === 'zm-page-copy').title, '复制本页为 Markdown');
// Z85-01：标题走 chrome.i18n.getMessage，create 时不带 messageKey；取不到时中文兜底
{
  const asked = []; const got = [];
  createMenus({ removeAll: (cb) => cb(), create: (o) => got.push(o) }, (k) => { asked.push(k); return 'EN:' + k; });
  assert.deepEqual(asked, ['menuPageExport', 'menuPageCopy', 'menuSelectionCopy', 'menuLinkExport']);
  assert.deepEqual(got.map((c) => c.title), asked.map((k) => 'EN:' + k));
  assert.ok(got.every((c) => !('messageKey' in c)), 'messageKey 不能传给 contextMenus.create');
  const fb = []; createMenus({ removeAll: (cb) => cb(), create: (o) => fb.push(o) }, () => '');
  assert.deepEqual(fb.map((c) => c.title), ['导出本页为 Markdown', '复制本页为 Markdown', '复制选中内容为 Markdown', '导出链接的知乎页面为 Markdown']);
  const loc = JSON.parse(fs.readFileSync(new URL('../_locales/zh_CN/messages.json', import.meta.url), 'utf8'));
  for (const it of MENU_ITEMS) assert.equal(loc[it.messageKey].message, it.title, it.id + ' 兜底与 zh_CN 一致');
}

assert.ok(isExportableLink('https://zhuanlan.zhihu.com/p/123'));
assert.ok(!isExportableLink('https://www.zhihu.com/hot'));
assert.ok(isExportableLink('https://www.zhihu.com/question/1/answer/2'));
assert.ok(!isExportableLink('https://www.zhihu.com/people/x'));
assert.ok(!isExportableLink('https://evil.com/zhihu.com/p/1'));
assert.ok(!isExportableLink('not a url'));

const sent = []; const opened = [];
const api = {
  tabs: { sendMessage: async (id, m) => { sent.push([id, m.action]); return { success: true }; },
    create: async (o) => { opened.push(o); return { id: 99 }; } },
  openAndWait: async (o) => { opened.push(o); return { id: 99 }; },
};
await handleMenuClick({ menuItemId: 'zm-page-export' }, { id: 1 }, api);
await handleMenuClick({ menuItemId: 'zm-page-copy' }, { id: 1 }, api);
await handleMenuClick({ menuItemId: 'zm-selection-copy', selectionText: 'x' }, { id: 1 }, api);
await handleMenuClick({ menuItemId: 'zm-link-export', linkUrl: 'https://zhuanlan.zhihu.com/p/5' }, { id: 1, index: 2 }, api);
const r = await handleMenuClick({ menuItemId: 'zm-link-export', linkUrl: 'https://www.zhihu.com/people/a' }, { id: 1 }, api);
assert.deepEqual(sent, [[1, 'triggerExport'], [1, 'contextCopy'], [1, 'copySelection'], [99, 'triggerExport']]);
assert.deepEqual(opened, [{ url: 'https://zhuanlan.zhihu.com/p/5', active: true, index: 3 }]);
assert.equal(r.reason, 'unsupported');

// openAndWait：先挂监听再建 tab；create 时已 complete 直接放行；complete 早于 create 返回也能识别；完成/超时都移除监听
{
  const mk = (createImpl) => { const ls = new Set(); return { ls, onUpdated: { addListener: (f) => ls.add(f), removeListener: (f) => ls.delete(f) }, create: createImpl }; };
  // 1) create 前已注册监听；complete 在 create resolve 之前到达
  let t = mk(null);
  t.create = async () => { assert.equal(t.ls.size, 1, '监听必须在 create 之前注册'); for (const f of [...t.ls]) f(7, { status: 'complete' }); return { id: 7, status: 'loading' }; };
  let t0 = Date.now(); let r1 = await openAndWait(t, {}, 1000); assert.equal(r1.id, 7); assert.ok(Date.now() - t0 < 200, '不应白等超时'); assert.equal(t.ls.size, 0);
  // 2) create 返回 status complete
  t = mk(async () => ({ id: 8, status: 'complete' })); t0 = Date.now(); await openAndWait(t, {}, 1000); assert.ok(Date.now() - t0 < 200); assert.equal(t.ls.size, 0);
  // 3) 正常：之后才 complete，只认目标 tab
  t = mk(async () => ({ id: 9, status: 'loading' })); let done = false;
  const p = openAndWait(t, {}, 1000).then(() => { done = true; });
  await new Promise((res) => setTimeout(res, 5));
  for (const f of [...t.ls]) f(10, { status: 'complete' }); for (const f of [...t.ls]) f(9, { status: 'loading' });
  await new Promise((res) => setTimeout(res, 5)); assert.equal(done, false);
  for (const f of [...t.ls]) f(9, { status: 'complete' }); await p; assert.equal(t.ls.size, 0);
  // 4) 超时也移除监听，并带 timedOut 标记；正常完成不带
  t = mk(async () => ({ id: 11, status: 'loading' })); const rt = await openAndWait(t, {}, 20); assert.equal(t.ls.size, 0);
  assert.equal(rt.timedOut, true); assert.equal(rt.id, 11); assert.equal(r1.timedOut, undefined);
}

// 审查建议 2：openAndWait 超时后不发导出指令，给出可见失败反馈（徽标「!」+ 提示文字）
{
  const sent2 = []; const fails = [];
  const api2 = {
    tabs: { sendMessage: async (id, m) => { sent2.push([id, m.action]); return { success: true }; } },
    openAndWait: async () => ({ id: 55, timedOut: true }),
    notifyFailure: async (id, reason) => { fails.push([id, reason]); },
  };
  const rr = await handleMenuClick({ menuItemId: 'zm-link-export', linkUrl: 'https://www.zhihu.com/question/1' }, { id: 1, index: 0 }, api2);
  assert.deepEqual(sent2, [], '超时后不能再发 triggerExport');
  assert.deepEqual(fails, [[55, 'timeout']]);
  assert.deepEqual(rr, { success: false, reason: 'timeout' });
  // 真实 openAndWait 串起来：超时 → 不发指令
  const ls = new Set(); const tabs3 = { onUpdated: { addListener: (f) => ls.add(f), removeListener: (f) => ls.delete(f) }, create: async () => ({ id: 66, status: 'loading' }), sendMessage: async (id, m) => { sent2.push([id, m.action]); } };
  await handleMenuClick({ menuItemId: 'zm-link-export', linkUrl: 'https://zhuanlan.zhihu.com/p/3' }, { id: 1, index: 0 }, { tabs: tabs3, openAndWait: (p) => openAndWait(tabs3, p, 20), notifyFailure: api2.notifyFailure });
  assert.deepEqual(sent2, []); assert.deepEqual(fails[1], [66, 'timeout']);
  // showLinkFailure：只用 chrome.action（徽标 + 标题），标签页已关闭时不抛错
  const calls = []; const action = { setBadgeBackgroundColor: async (o) => calls.push(['bg', o]), setBadgeText: async (o) => calls.push(['text', o]), setTitle: async (o) => calls.push(['title', o]) };
  await showLinkFailure(action, 66);
  assert.deepEqual(calls.find(([k]) => k === 'text')[1], { tabId: 66, text: '!' });
  assert.equal(calls.find(([k]) => k === 'title')[1].title, LINK_TIMEOUT_TITLE);
  // 发版审计 N5：徽标文字颜色显式白色；旧版 Chrome 没有 setBadgeTextColor 时不报错（上面的 action 就没有）
  const tc = []; await showLinkFailure({ ...action, setBadgeTextColor: async (o) => tc.push(o) }, 68);
  assert.deepEqual(tc, [{ tabId: 68, color: '#ffffff' }]);
  await showLinkFailure({ setBadgeBackgroundColor: async () => { throw new Error('No tab'); }, setBadgeText: () => { throw new Error('No tab'); }, setTitle: async () => { throw new Error('x'); } }, 67);
}

// 接线（审查建议 2）：background.js 在 onInstalled 里注册菜单、在顶层挂 onClicked 并分发；去掉任一处都失败
{
  const L = {}; const on = (k) => ({ addListener: (f) => { (L[k] = L[k] || []).push(f); } });
  const made = []; const msgs = [];
  globalThis.chrome = {
    runtime: { onMessage: on('msg'), onInstalled: on('installed'), lastError: null },
    commands: { onCommand: on('command') },
    contextMenus: { removeAll: (cb) => cb && cb(), create: (o) => made.push(o), onClicked: on('clicked') },
    tabs: { sendMessage: async (id, m) => { msgs.push([id, m.action]); return { success: true }; }, query: async () => [], onUpdated: on('updated'), create: async () => ({ id: 1 }) },
    downloads: { download: () => {} }, storage: { local: { get: async () => ({}), set: async () => {} } },
  };
  await import('../background/background.js?wiring');
  assert.equal(made.length, 0, '加载时不应注册（应在 onInstalled 里）');
  assert.ok((L.installed || []).length >= 1, '需监听 onInstalled');
  for (const f of L.installed) await f({ reason: 'install' });
  assert.deepEqual(made.map((m) => m.id), ['zm-page-export', 'zm-page-copy', 'zm-selection-copy', 'zm-link-export'], 'onInstalled 注册 4 项');
  assert.equal((L.clicked || []).length, 1, '需在顶层挂 contextMenus.onClicked');
  L.clicked[0]({ menuItemId: 'zm-page-copy' }, { id: 42 });
  await new Promise((res) => setTimeout(res, 5));
  assert.deepEqual(msgs, [[42, 'contextCopy']], 'onClicked 分发到 handleMenuClick');
}

// 选区 → Markdown
{
  const { document, window } = parseHTML('<html><body><div class="RichText"><p>前面 <b>粗体</b> 和 <a href="https://www.zhihu.com/question/1">链接</a></p><p>第二段</p></div></body></html>');
  globalThis.window = window; globalThis.document = document;
  const { selectionToMarkdown } = await import('../content/modules/selection-md.js');
  const ps = document.querySelectorAll('p');
  // linkedom 的 Range 不完整：用最小替身（cloneContents 返回两段的副本）
  const range = { commonAncestorContainer: ps[0].parentNode, cloneContents: () => {
    const f = document.createDocumentFragment(); ps.forEach((p) => f.appendChild(p.cloneNode(true))); return f; } };
  const sel = { isCollapsed: false, rangeCount: 1, getRangeAt: () => range };
  const md = selectionToMarkdown(sel);
  assert.match(md, /\*\*粗体\*\*/);
  assert.match(md, /\[链接\]\(https:\/\/www\.zhihu\.com\/question\/1\)/);
  assert.match(md, /第二段/);
  assert.equal(selectionToMarkdown({ isCollapsed: true, rangeCount: 1 }), '');
  assert.equal(selectionToMarkdown(null), '');
}

const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8');
assert.match(html, /· 右键也可导出/);
console.log('context menu tests passed');

// 接线：background.js 把 notifyFailure 接到 chrome.action（showLinkFailure）
{
  const { readFileSync } = await import('node:fs');
  const bg = readFileSync(new URL('../background/background.js', import.meta.url), 'utf8');
  assert.match(bg, /notifyFailure: \(tabId\) => showLinkFailure\(chrome\.action, tabId\)/);
  console.log('context menu timeout feedback tests passed');
}
