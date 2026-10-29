// 审查 P3-3：图片下载只允许 https://*.zhimg.com（代码层，不改 manifest 权限）
import assert from 'node:assert/strict';
import { isAllowedImageUrl } from '../lib/image-pack.js';

for (const ok of ['https://pic1.zhimg.com/v2-a.jpg', 'https://zhimg.com/a.png', 'https://PIC4.ZHIMG.COM/x']) assert.ok(isAllowedImageUrl(ok), ok);
for (const bad of ['http://pic1.zhimg.com/a.jpg', 'https://evil.com/a.jpg', 'https://zhimg.com.evil.com/a.jpg',
  'https://evilzhimg.com/a.jpg', 'https://pic1.zhimg.com@evil.com/a.jpg', 'data:image/png;base64,AA', 'javascript:alert(1)', '', null]) {
  assert.ok(!isAllowedImageUrl(bad), String(bad));
}

// background：不在白名单的 URL 不会被 fetch，按下载失败处理（保留在线链接）
const L = {}; let dlUrl = null; const fetched = [];
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
globalThis.fetch = async (u) => { fetched.push(String(u)); return { ok: true, headers: { get: () => 'image/png' }, blob: async () => new Blob([PNG]) }; };
await import('../background/background.js?imgurl');
const images = [
  { url: 'https://pic1.zhimg.com/v2-a.png', filename: 'img_001_a.png' },
  { url: 'http://pic2.zhimg.com/v2-b.png', filename: 'img_002_b.png' },
  { url: 'https://evil.example/c.png', filename: 'img_003_c.png' },
];
const md = images.map((im) => `![](images/${im.filename})`).join('\n');
const res = await new Promise((done) => L.msg({ action: 'download', filename: 'a.md', content: md, images, downloadImages: true, title: 'a' }, {}, done));
assert.deepEqual(fetched, ['https://pic1.zhimg.com/v2-a.png'], '只 fetch 白名单内的图片');
assert.equal(res.failedImages, 2);
const zip = Buffer.from(dlUrl.split(',')[1], 'base64').toString('latin1');
assert.ok(zip.includes('](https://evil.example/c.png)') && zip.includes('](http://pic2.zhimg.com/v2-b.png)'));
console.log('image url allowlist tests passed');
