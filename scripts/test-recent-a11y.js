// fix3 Z3-02：「最近导出」状态图标 span 带 aria-label 时必须有 role="img"，否则 axe 报 aria-prohibited-attr
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const flush = () => new Promise((r) => setImmediate(r));
const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const { window, document } = parseHTML(html);
globalThis.window = window; globalThis.document = document;
const local = { recentExports: [{ ok: true, title: '成功的', ts: Date.now() }, { ok: false, title: '失败的', ts: Date.now() }] };
globalThis.chrome = {
  tabs: { query: async () => [{ id: 1, url: 'https://example.com/' }], sendMessage: async () => ({ success: false }), reload() {} },
  runtime: { sendMessage: async () => ({}), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
  commands: { getAll: async () => [] },
  downloads: { show() {} },
  storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => ({ ...d, ...local }), set: async (o) => Object.assign(local, o) } },
};
await import('../popup/popup.js');
for (let i = 0; i < 8; i++) await flush();
const badges = [...document.querySelectorAll('#recent-list .badge')];
assert.equal(badges.length, 2, 'two recent rows rendered');
assert.deepEqual(badges.map((b) => b.getAttribute('aria-label')), ['成功', '失败']);
for (const b of badges) assert.equal(b.getAttribute('role'), 'img', `span[aria-label=${b.getAttribute('aria-label')}] needs role="img"`);
for (const b of badges) assert.equal(b.querySelector('svg').getAttribute('aria-hidden'), 'true', 'inner svg stays decorative');
console.log('recent a11y tests passed');
