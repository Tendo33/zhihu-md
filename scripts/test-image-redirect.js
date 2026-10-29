// 审查 P3（release-polish-2 ①）：图片 fetch 不跟随重定向；zhimg 30x 跳到白名单外主机 → 下载失败，保留在线链接
import assert from 'node:assert/strict';

const L = {}; let dlUrl = null; const calls = [];
const ev = (n) => ({ addListener: (fn) => { L[n] = fn; } });
globalThis.chrome = {
  runtime: { onMessage: ev('msg'), onInstalled: ev('inst'), id: 'me' },
  commands: { onCommand: ev('cmd') },
  contextMenus: { create() {}, removeAll: (cb) => cb && cb(), onClicked: ev('menu') },
  tabs: { query: async () => [], sendMessage: async () => ({}) },
  downloads: { download: async (o) => { dlUrl = o.url; return 7; } },
  storage: { local: { get: async (d) => d, set: async () => {} }, sync: { get: (d, cb) => cb(d) } },
};
globalThis.FileReader = class { readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = 'data:application/zip;base64,' + Buffer.from(b).toString('base64'); this.onload(); }); } };
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// 模拟 fetch 的重定向语义：/redir 返回 302 → https://evil.example/x.png
globalThis.fetch = async (u, opts = {}) => {
  calls.push({ url: String(u), redirect: opts.redirect });
  if (String(u).includes('/redir')) {
    if (opts.redirect === 'error') throw new TypeError('Failed to fetch: redirect mode is "error"');
    if (opts.redirect === 'manual') return { ok: false, status: 0, type: 'opaqueredirect', url: String(u), headers: { get: () => null }, blob: async () => new Blob([]) };
    return { ok: true, status: 200, redirected: true, url: 'https://evil.example/x.png', headers: { get: () => 'image/png' }, blob: async () => new Blob([PNG]) };
  }
  return { ok: true, status: 200, url: String(u), headers: { get: () => 'image/png' }, blob: async () => new Blob([PNG]) };
};
await import('../background/background.js?redirect');
const images = [
  { url: 'https://pic1.zhimg.com/v2-a.png', filename: 'img_001_a.png' },
  { url: 'https://pic2.zhimg.com/redir/v2-b.png', filename: 'img_002_b.png' },
];
const md = images.map((im) => `![](images/${im.filename})`).join('\n');
const res = await new Promise((done) => L.msg({ action: 'download', filename: 'a.md', content: md, images, downloadImages: true, title: 'a' }, {}, done));
assert.ok(calls.every((c) => c.redirect === 'error'), '每次图片 fetch 都带 redirect:error');
assert.equal(res.failedImages, 1, '跳到白名单外主机的图片算下载失败');
const zip = Buffer.from(dlUrl.split(',')[1], 'base64').toString('latin1');
assert.ok(zip.includes('](https://pic2.zhimg.com/redir/v2-b.png)'), '失败的图片保留原始在线链接');
assert.ok(zip.includes('images/img_001_a.png'), '正常图片照常打包');
console.log('image redirect tests passed');
