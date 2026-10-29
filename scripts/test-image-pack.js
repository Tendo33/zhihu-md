// 发版 QA ZR-09：图片下载失败 → Markdown 退回在线链接；扩展名按 Content-Type / 魔数；界面提示数量
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { applyImageResults, extFromContentType, extFromMagic, imageFailText, withExt } from '../lib/image-pack.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

// 扩展名识别
assert.equal(extFromContentType('image/png'), 'png');
assert.equal(extFromContentType('image/jpeg; charset=binary'), 'jpg');
assert.equal(extFromContentType('IMAGE/WEBP'), 'webp');
assert.equal(extFromContentType('application/octet-stream'), null);
assert.equal(extFromContentType(''), null);
assert.equal(extFromMagic(PNG), 'png');
assert.equal(extFromMagic(JPG), 'jpg');
assert.equal(extFromMagic(WEBP), 'webp');
assert.equal(extFromMagic(GIF), 'gif');
assert.equal(extFromMagic(Uint8Array.from([1, 2, 3])), null);
assert.equal(withExt('img_001_v2-abc.jpg', 'png'), 'img_001_v2-abc.png');
assert.equal(withExt('img_002_noext', 'webp'), 'img_002_noext.webp');
assert.equal(withExt('img_003_a.jpg', null), 'img_003_a.jpg');

// 审查 P3-4：去掉 Content-Type 识别或 webp 的 WEBP 标记检查时必须失败
const UNKNOWN = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const RIFF_WAVE = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);
assert.equal(extFromMagic(RIFF_WAVE), null, 'RIFF 但不是 WEBP 不能当 webp');
{
  const one = [{ url: 'https://pic1.zhimg.com/v2-q.jpg', filename: 'img_009_q.jpg' }];
  // 复审 51f7f33 P3：魔数认不出时不信 Content-Type → kept，保留在线链接
  const ct = applyImageResults('![](images/img_009_q.jpg)', one, [{ ok: true, data: UNKNOWN, contentType: 'image/gif' }]);
  assert.equal(ct.files.length, 0, '魔数认不出时不按 Content-Type 存文件');
  assert.equal(ct.kept, 1);
  const HTML = new TextEncoder().encode('<!DOCTYPE html><html><body>404 Not Found</body></html>');
  const html = applyImageResults('![](images/img_009_q.jpg)', one, [{ ok: true, data: HTML, contentType: 'image/jpeg' }]);
  assert.equal(html.files.length, 0, 'image/jpeg + HTML 正文：不存 .jpg');
  assert.equal(html.kept, 1, 'image/jpeg + HTML 正文 → kept');
  assert.equal(html.failed, 0);
  assert.equal(html.content, '![](https://pic1.zhimg.com/v2-q.jpg)', '保留在线链接');
  const wave = applyImageResults('![](images/img_009_q.jpg)', one, [{ ok: true, data: RIFF_WAVE, contentType: 'application/octet-stream' }]);
  assert.ok(!wave.files.some((f) => f.filename.endsWith('.webp')), 'RIFF/WAVE 不应存成 .webp');
}

// 审查 P3-5：魔数优先；SVG / 认不出的类型算下载失败，保留在线链接
{
  const one = [{ url: 'https://pic1.zhimg.com/v2-m.png', filename: 'img_010_m.png' }];
  const md1 = '![](images/img_010_m.png)';
  const magicFirst = applyImageResults(md1, one, [{ ok: true, data: JPG, contentType: 'image/png' }]);
  assert.deepEqual(magicFirst.files.map((f) => f.filename), ['img_010_m.jpg'], 'Content-Type 说 png、文件头是 JPEG → .jpg');
  const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  for (const [data, ct] of [[SVG, 'image/svg+xml'], [UNKNOWN, 'application/octet-stream'], [UNKNOWN, ''], [RIFF_WAVE, 'audio/wav']]) {
    const x = applyImageResults(md1, one, [{ ok: true, data, contentType: ct }]);
    assert.equal(x.failed, 0, `${ct || '无类型'} 不算下载失败`);
    assert.equal(x.kept, 1, `${ct || '无类型'} 计为保留在线链接（第三轮 B）`);
    assert.equal(x.files.length, 0);
    assert.equal(x.content, '![](https://pic1.zhimg.com/v2-m.png)');
  }
  assert.equal(extFromContentType('image/svg+xml'), null);
}

// 文案
assert.equal(imageFailText(2), '2 张图片未能下载，已保留在线链接');

// 回退与改名
const images = [
  { url: 'https://pic1.zhimg.com/v2-a.jpg', filename: 'img_001_v2-a.jpg' },
  { url: 'https://pic2.zhimg.com/v2-b.jpg', filename: 'img_002_v2-b.jpg' },
  { url: 'https://pic3.zhimg.com/v2-c.jpg', filename: 'img_003_v2-c.jpg' },
  { url: 'https://pic4.zhimg.com/v2-d.jpg', filename: 'img_004_v2-d.jpg' },
];
const md = images.map((im, i) => `![图${i}](images/${im.filename})`).join('\n\n') + '\n\n再引用一次 ![x](images/img_002_v2-b.jpg)\n';
const r = applyImageResults(md, images, [
  { ok: true, data: PNG, contentType: 'image/png' }, // .jpg URL 实际是 PNG → 改名
  { ok: false },
  { ok: true, data: JPG, contentType: '' }, // 没有 Content-Type → 魔数
  { ok: true, data: WEBP, contentType: 'application/octet-stream' }, // 不认识的类型 → 魔数
]);
assert.equal(r.failed, 1);
assert.deepEqual(r.files.map((f) => f.filename), ['img_001_v2-a.png', 'img_003_v2-c.jpg', 'img_004_v2-d.webp']);
assert.match(r.content, /!\[图0\]\(images\/img_001_v2-a\.png\)/);
assert.match(r.content, /!\[图1\]\(https:\/\/pic2\.zhimg\.com\/v2-b\.jpg\)/);
assert.match(r.content, /!\[x\]\(https:\/\/pic2\.zhimg\.com\/v2-b\.jpg\)/, '同一张图的多处引用都回退');
assert.match(r.content, /!\[图3\]\(images\/img_004_v2-d\.webp\)/);
const linked = [...r.content.matchAll(/\]\(images\/([^)]+)\)/g)].map((m) => m[1]);
for (const f of linked) assert.ok(r.files.some((x) => x.filename === f), '没有断链: ' + f);

// background 集成：download 消息 → zip 里的 Markdown 已回退，响应带 failedImages
{
  const L = {}; let dlUrl = null;
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
  globalThis.fetch = async (u) => (String(u).includes('pic2')
    ? { ok: false, status: 403 }
    : { ok: true, headers: { get: () => 'image/png' }, blob: async () => new Blob([PNG], { type: 'image/png' }) });
  await import('../background/background.js?zr09');
  const res = await new Promise((done) => L.msg({ action: 'download', filename: 'a.md', content: md, images, downloadImages: true, title: 'a' }, {}, done));
  assert.equal(res.success, true);
  assert.equal(res.failedImages, 1);
  const zip = Buffer.from(dlUrl.split(',')[1], 'base64').toString('latin1');
  assert.ok(zip.includes('images/img_001_v2-a.png'));
  assert.ok(!zip.includes('images/img_002_v2-b'), 'zip 和 Markdown 都不再有失败的那张');
  assert.ok(zip.includes('](https://pic2.zhimg.com/v2-b.jpg)'));
}

// popup：已保存 + 信息条「N 张图片未能下载，已保留在线链接」
{
  const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://zhuanlan.zhihu.com/p/1', title: 'p' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? { success: true, data: { title: 'P', author: '' } } : { success: true, data: { filename: 'p.md', content: '#', images: [{ url: 'u', filename: 'f' }] } }), reload() {} },
    runtime: { sendMessage: async () => ({ success: true, downloadId: 5, filename: 'p_with_images.zip', failedImages: 3 }), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb({ ...d, downloadImages: true }) }, local: { get: async (d) => ({ ...d, recentExports: [1, 2, 3].map((n) => ({ title: `t${n}`, ok: true, ts: Date.now() })) }), set: async () => {} } },
  };
  await import('../popup/popup.js?zr09');
  await flush();
  document.getElementById('export-btn').dispatchEvent(new window.Event('click'));
  await flush();
  const $ = (id) => document.getElementById(id);
  assert.ok(!$('action-ok').classList.contains('hidden'));
  assert.ok(!$('action-info').classList.contains('hidden'), '显示图片失败信息条');
  assert.equal($('info-text').textContent, '3 张图片未能下载，已保留在线链接');
  assert.ok($('refresh-btn').classList.contains('hidden'));
  await flush();
  assert.equal($('recent-list').children.length, 2, '设计建议 1：图片失败提示出现时最近导出缩为 2 行');
}

// 悬浮球：成功提示里带数量
const ball = fs.readFileSync(new URL('../content/modules/floating-ball.js', import.meta.url), 'utf8');
assert.match(ball, /failedN > 0 \? `已导出，\$\{imageFailText\(failedN\)\}` : '已导出'/);
console.log('image pack tests passed');

// 审查 P3（release-polish-2 ③）：Content-Type 为 octet-stream 时，avif / bmp 只能靠文件头识别
{
  const AVIF = Uint8Array.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0]);
  const AVIS = Uint8Array.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73, 0, 0, 0, 0]);
  const HEIC = Uint8Array.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
  const BMP = Uint8Array.from([0x42, 0x4d, 0x36, 0, 0, 0, 0, 0, 0, 0, 0x36, 0]);
  const one = [{ url: 'https://pic1.zhimg.com/v2-m.jpg', filename: 'img_010_m.jpg' }];
  const name = (data) => applyImageResults('![](images/img_010_m.jpg)', one, [{ ok: true, data, contentType: 'application/octet-stream' }]).files.map((f) => f.filename);
  assert.deepEqual(name(AVIF), ['img_010_m.avif'], 'ftyp avif + octet-stream → .avif');
  assert.deepEqual(name(AVIS), ['img_010_m.avif'], 'ftyp avis + octet-stream → .avif');
  assert.deepEqual(name(BMP), ['img_010_m.bmp'], 'BM + octet-stream → .bmp');
  assert.deepEqual(name(HEIC), [], 'ftyp heic 不是 avif，按无法识别处理');
}
// 主管定：major brand 不是 avif/avis 时查 compatible brands
{
  const box = (size, ...brands) => Uint8Array.from([(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, 0x66, 0x74, 0x79, 0x70, ...brands.flatMap((s) => [...s].map((c) => c.charCodeAt(0)))]);
  const one = [{ url: 'https://pic1.zhimg.com/v2-m.jpg', filename: 'img_011_m.jpg' }];
  const res = (data) => applyImageResults('![](images/img_011_m.jpg)', one, [{ ok: true, data, contentType: 'image/avif' }]);
  const pos = res(box(28, 'mif1', '\0\0\0\0', 'mif1', 'avif', 'miaf'));
  assert.deepEqual(pos.files.map((f) => f.filename), ['img_011_m.avif'], 'mif1 + compatible avif → .avif');
  assert.equal(extFromMagic(box(24, 'mif1', '\0\0\0\0', 'mif1', 'avis')), 'avif', 'mif1 + avis → avif');
  const neg = res(box(28, 'mif1', '\0\0\0\0', 'mif1', 'heic', 'miaf'));
  assert.equal(neg.files.length, 0, 'mif1 + heic → 不存');
  assert.equal(neg.kept, 1, 'mif1 + heic → kept');
  // 边界：avif 在 box 声明的长度之外不算
  assert.equal(extFromMagic(Uint8Array.from([...box(20, 'mif1', '\0\0\0\0', 'mif1'), ...[...'avif'].map((c) => c.charCodeAt(0))])), null, 'box 长度之外的 avif 不算');
  // 截断：声明 size 很大但缓冲区只到一半，不越界、不误判
  const cut = box(64, 'mif1', '\0\0\0\0', 'mif1', 'av');
  assert.equal(extFromMagic(cut), null, '截断的 brand 不算');
  assert.equal(extFromMagic(box(64, 'mif1', '\0\0\0\0', 'avif')), 'avif', 'size 大于缓冲区时按实际长度扫');
  assert.equal(extFromMagic(box(0, 'mif1', '\0\0\0\0', 'avif')), 'avif', 'size=0 表示到末尾');
  assert.equal(extFromMagic(box(1, 'mif1', '\0\0\0\0', 'avif')), null, 'size=1（64 位长度）不扫 compatible');
  assert.equal(extFromMagic(box(16, 'mif1', '\0\0\0\0')), null, '没有 compatible brands');
  // 复审 32569cb P3：avif 写在 minor_version 位置不算；没按 4 字节对齐的 avif 不算
  assert.equal(extFromMagic(box(20, 'mif1', 'avif', 'mif1')), null, 'avif 在 minor_version 位置 → null');
  assert.equal(extFromMagic(box(28, 'mif1', '\0\0\0\0', 'mi', 'avif', 'f1', 'miaf')), null, 'avif 跨 4 字节对齐 → null');
  assert.equal(extFromMagic(box(12, 'mif1').slice(0, 10)), null, '短缓冲区');
}
console.log('image pack avif/bmp magic tests passed');
