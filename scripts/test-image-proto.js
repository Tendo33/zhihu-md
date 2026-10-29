// QA P2Z-01：以 // 开头的图片在 Markdown 里要写成 https://（本地打开 .md 时 // 会被解析成 file://）
// 覆盖：打包时下载失败（failed）、按白名单/格式保留（kept）、不打包图片时的普通导出；
// 已经是绝对地址的不动，下载成功后的 images/ 本地路径不受影响。
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { applyImageResults, markdownImageUrl } from '../lib/image-pack.js';
import { createTurndownService } from '../content/modules/turndown-rules.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const UNKNOWN = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

// 纯函数
assert.equal(markdownImageUrl('//pic3.zhimg.com/v2-proto404.jpg'), 'https://pic3.zhimg.com/v2-proto404.jpg');
assert.equal(markdownImageUrl('//img.example.com/a.png?x=1'), 'https://img.example.com/a.png?x=1');
assert.equal(markdownImageUrl('https://pic1.zhimg.com/v2-a.jpg'), 'https://pic1.zhimg.com/v2-a.jpg');
// 主管决定（P2Z 追加）：http 的 zhimg 升 https；其他域名 http 不动
assert.equal(markdownImageUrl('http://pic1.zhimg.com/v2-a.jpg'), 'https://pic1.zhimg.com/v2-a.jpg');
assert.equal(markdownImageUrl('http://picx.zhimg.com/v2-a.jpg?source=1940ef5c#f'), 'https://picx.zhimg.com/v2-a.jpg?source=1940ef5c#f');
assert.equal(markdownImageUrl('http://zhimg.com/a.jpg'), 'https://zhimg.com/a.jpg');
assert.equal(markdownImageUrl('HTTP://Pic2.ZHIMG.com/v2-A.JPG'), 'https://Pic2.ZHIMG.com/v2-A.JPG', '协议和主机名大小写');
assert.equal(markdownImageUrl('http://pic1.zhimg.com:80/v2-a.jpg'), 'https://pic1.zhimg.com/v2-a.jpg', ':80 去掉');
assert.equal(markdownImageUrl('http://pic1.zhimg.com:8080/v2-a.jpg'), 'http://pic1.zhimg.com:8080/v2-a.jpg', '非默认端口不动');
assert.equal(markdownImageUrl('http://u:p@pic1.zhimg.com/v2-a.jpg'), 'http://u:p@pic1.zhimg.com/v2-a.jpg', '带用户信息不动');
assert.equal(markdownImageUrl('http://zhimg.com.evil.com/a.jpg'), 'http://zhimg.com.evil.com/a.jpg', '仿冒域名不动');
assert.equal(markdownImageUrl('http://evilzhimg.com/a.jpg'), 'http://evilzhimg.com/a.jpg', '后缀不是 .zhimg.com 不动');
assert.equal(markdownImageUrl('http://img.example.com/a.png?u=http://pic1.zhimg.com/x'), 'http://img.example.com/a.png?u=http://pic1.zhimg.com/x', '查询串里的 zhimg 不算');
assert.equal(markdownImageUrl('https://PIC1.zhimg.com/v2-a.jpg'), 'https://PIC1.zhimg.com/v2-a.jpg', 'https 不变');
assert.equal(markdownImageUrl('//PIC1.zhimg.com:8080/a.jpg'), 'https://PIC1.zhimg.com:8080/a.jpg', '// 仍按原逻辑');
assert.equal(markdownImageUrl('http://img.example.com/a.png'), 'http://img.example.com/a.png', '绝对地址不动');
assert.equal(markdownImageUrl('images/img_001_a.png'), 'images/img_001_a.png');

// 打包：失败 / 保留（白名单外）/ 保留（格式认不出）/ 成功 / 绝对地址失败
{
  const images = [
    { url: '//pic3.zhimg.com/v2-proto404.jpg', filename: 'img_001_v2-proto404.jpg' },
    { url: '//img.example.com/ext.png', filename: 'img_002_ext.png' },
    { url: '//pic2.zhimg.com/v2-svg.jpg', filename: 'img_003_v2-svg.jpg' },
    { url: '//pic4.zhimg.com/v2-ok.jpg', filename: 'img_004_v2-ok.jpg' },
    { url: 'http://pic1.zhimg.com/v2-old.jpg', filename: 'img_005_v2-old.jpg' },
    { url: 'https://pic1.zhimg.com/v2-abs.jpg', filename: 'img_006_v2-abs.jpg' },
    { url: 'http://img.example.com/old.png', filename: 'img_007_old.png' },
  ];
  const md = images.map((img, i) => `![图${i + 1}](images/${img.filename})`).join('\n\n');
  const r = applyImageResults(md, images, [
    { ok: false },
    { ok: false, kept: true },
    { ok: true, data: UNKNOWN, contentType: 'image/svg+xml' },
    { ok: true, data: PNG, contentType: 'image/jpeg' },
    { ok: false },
    { ok: false },
    { ok: false, kept: true },
  ]);
  const lines = r.content.split('\n\n');
  assert.equal(lines[0], '![图1](https://pic3.zhimg.com/v2-proto404.jpg)', 'failed：// 补成 https://');
  assert.equal(lines[1], '![图2](https://img.example.com/ext.png)', 'kept（白名单外）：// 补成 https://');
  assert.equal(lines[2], '![图3](https://pic2.zhimg.com/v2-svg.jpg)', 'kept（格式认不出）：// 补成 https://');
  assert.equal(lines[3], '![图4](images/img_004_v2-ok.png)', '下载成功：本地路径不受影响');
  assert.equal(lines[4], '![图5](https://pic1.zhimg.com/v2-old.jpg)', 'failed：http 的 zhimg 升成 https');
  assert.equal(lines[5], '![图6](https://pic1.zhimg.com/v2-abs.jpg)', '绝对 https 地址原样保留');
  assert.doesNotMatch(r.content, /\]\(\/\//, 'Markdown 里不再有 ](// 链接');
  assert.equal(lines[6], '![图7](http://img.example.com/old.png)', 'kept：非 zhimg 的 http 不动');
  assert.equal(r.failed, 3);
  assert.equal(r.kept, 3);
  assert.deepEqual(r.files.map((f) => f.filename), ['img_004_v2-ok.png']);
}

// 不打包图片：普通导出 / 复制时同样补全；打包模式仍写 images/ 本地路径
{
  const { document } = parseHTML(`<!doctype html><html><body><article>
    <p><img src="//pic3.zhimg.com/v2-proto_720w.jpg" alt="协议相对"></p>
    <p><img data-original="//pic1.zhimg.com/v2-orig_r.jpg" src="data:image/svg+xml;utf8,x" alt="原图"></p>
    <p><img src="https://pic2.zhimg.com/v2-abs_720w.jpg" alt="绝对"></p>
    <p><img src="http://pic2.zhimg.com/v2-old.jpg" alt="老图"></p>
    <p><img src="http://img.example.com/x.png" alt="外站"></p>
  </article></body></html>`);
  const article = document.querySelector('article');
  const plain = createTurndownService(false).turndown(article);
  assert.match(plain, /!\[协议相对\]\(https:\/\/pic3\.zhimg\.com\/v2-proto\.jpg\)/);
  assert.match(plain, /!\[原图\]\(https:\/\/pic1\.zhimg\.com\/v2-orig\.jpg\)/);
  assert.match(plain, /!\[绝对\]\(https:\/\/pic2\.zhimg\.com\/v2-abs\.jpg\)/);
  assert.match(plain, /!\[老图\]\(https:\/\/pic2\.zhimg\.com\/v2-old\.jpg\)/, 'http 的 zhimg 升成 https');
  assert.match(plain, /!\[外站\]\(http:\/\/img\.example\.com\/x\.png\)/, '非 zhimg 的 http 不动');
  assert.doesNotMatch(plain, /\]\(\/\//);

  const td = createTurndownService(true);
  const packed = td.turndown(article);
  assert.match(packed, /!\[协议相对\]\(images\/img_001_v2-proto\.jpg\)/, '打包模式仍写本地路径');
  assert.equal(td.imageCollector.images[0].url, '//pic3.zhimg.com/v2-proto.jpg', '下载地址由 normalizeImageUrl 处理，收集时不改');
}
console.log('image protocol-relative tests passed');
