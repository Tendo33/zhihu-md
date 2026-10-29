// 审查 P3-3：图片下载只允许 https://*.zhimg.com（代码层，不改 manifest 权限）
import assert from 'node:assert/strict';
import { isAllowedImageUrl, normalizeImageUrl } from '../lib/image-pack.js';

for (const ok of ['https://pic1.zhimg.com/v2-a.jpg', 'https://zhimg.com/a.png', 'https://PIC4.ZHIMG.COM/x']) assert.ok(isAllowedImageUrl(ok), ok);
for (const bad of ['ftp://pic1.zhimg.com/a.jpg', 'http://evil.com/a.jpg', '//evil.com/a.jpg', 'https://evil.com./a.jpg', '/v2-a.jpg', 'https://evil.com/a.jpg', 'https://zhimg.com.evil.com/a.jpg',
  'https://evilzhimg.com/a.jpg', 'https://pic1.zhimg.com@evil.com/a.jpg', 'data:image/png;base64,AA', 'javascript:alert(1)', '', null]) {
  assert.ok(!isAllowedImageUrl(bad), String(bad));
}

// 审查 P3（release-polish-2 ②）：http 和 // 开头的老 zhimg 图升级成 https；主机名末尾的点去掉
assert.equal(normalizeImageUrl('http://pic1.zhimg.com/v2-a.jpg'), 'https://pic1.zhimg.com/v2-a.jpg');
assert.equal(normalizeImageUrl('//pic2.zhimg.com/v2-b.jpg?x=1'), 'https://pic2.zhimg.com/v2-b.jpg?x=1');
assert.equal(normalizeImageUrl('https://pic3.zhimg.com./v2-c.jpg'), 'https://pic3.zhimg.com/v2-c.jpg');
assert.equal(normalizeImageUrl('http://PIC4.ZHIMG.COM./d.png'), 'https://pic4.zhimg.com/d.png');
assert.equal(normalizeImageUrl('https://zhimg.com.evil.com./a.jpg'), null);
assert.equal(normalizeImageUrl('/v2-a.jpg'), null, '相对路径解析到 www.zhihu.com，不在白名单');

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
  { url: '//pic3.zhimg.com/v2-d.png', filename: 'img_004_d.png' },
  { url: 'https://pic4.zhimg.com./v2-e.png', filename: 'img_005_e.png' },
  { url: 'http://evil.example/f.png', filename: 'img_006_f.png' },
];
const md = images.map((im) => `![](images/${im.filename})`).join('\n');
const res = await new Promise((done) => L.msg({ action: 'download', filename: 'a.md', content: md, images, downloadImages: true, title: 'a' }, {}, done));
assert.deepEqual(fetched, ['https://pic1.zhimg.com/v2-a.png', 'https://pic2.zhimg.com/v2-b.png', 'https://pic3.zhimg.com/v2-d.png', 'https://pic4.zhimg.com/v2-e.png'], '只 fetch 白名单内的图片，http 和 // 升级为 https');
assert.equal(res.failedImages, 0, '白名单外的图片不算下载失败（第三轮 B）');
assert.equal(res.keptImages, 2, '白名单外的图片计入保留在线链接');
const zip = Buffer.from(dlUrl.split(',')[1], 'base64').toString('latin1');
assert.ok(zip.includes('](https://evil.example/c.png)') && zip.includes('](http://evil.example/f.png)') && zip.includes('images/img_002_b.png') && zip.includes('images/img_004_d.png'));
console.log('image url allowlist tests passed');
