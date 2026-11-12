// 图片文件夹设置：名称校验、Markdown 路径、ZIP 条目都要跟着设置走，非法名回退默认
import assert from 'node:assert/strict';
import { applyImageResults, DEFAULT_IMAGE_DIR, normalizeImageDir } from '../lib/image-pack.js';
import { createZipWithImages } from '../lib/zip.js';
import { createTurndownService } from '../content/modules/turndown-rules.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// 合法名字：默认值、前后空格、中文、点/下划线/短横线
assert.deepEqual(normalizeImageDir('images'), { dir: 'images', error: '' });
assert.deepEqual(normalizeImageDir(' assets '), { dir: 'assets', error: '' });
assert.deepEqual(normalizeImageDir('图片_2026-11'), { dir: '图片_2026-11', error: '' });
assert.deepEqual(normalizeImageDir('my.assets'), { dir: 'my.assets', error: '' });

// 不支持的名字：统一回退默认，error 交给设置页提示
for (const [value, error] of [
  ['', 'empty'],
  ['   ', 'empty'],
  ['a/b', 'charset'],
  ['a\\b', 'charset'],
  ['my assets', 'charset'],
  ['assets(1)', 'charset'],
  ['assets#1', 'charset'],
  ['..', 'dots'],
  ['.git', 'dots'],
  ['assets.', 'dots'],
  ['con', 'reserved'],
  ['LPT1', 'reserved'],
  ['x'.repeat(33), 'too_long'],
]) {
  assert.deepEqual(normalizeImageDir(value), { dir: DEFAULT_IMAGE_DIR, error }, `非法值：${value}`);
}

// Markdown 路径：默认 images，自定义跟随设置
assert.equal(createTurndownService(true).imageCollector.addImage('u', 'img_001_a.png'), 'images/img_001_a.png');
assert.equal(createTurndownService(true, 'assets').imageCollector.addImage('u', 'img_001_a.png'), 'assets/img_001_a.png');

// 打包：替换和扩展名改名都写在设置的文件夹里
const images = [{ url: 'https://pic1.zhimg.com/v2-a.jpg', filename: 'img_001_v2-a.jpg' }];
const packed = applyImageResults('![](assets/img_001_v2-a.jpg)', images, [{ ok: true, data: PNG }], 'assets');
assert.deepEqual(packed.files.map((f) => f.filename), ['img_001_v2-a.png']);
assert.equal(packed.content, '![](assets/img_001_v2-a.png)');

// ZIP 条目用设置的目录，且不再出现默认目录
const blob = await createZipWithImages('a.md', '# x', [{ filename: 'img_001_v2-a.png', data: PNG }], 'assets');
const zip = Buffer.from(await blob.arrayBuffer()).toString('latin1');
assert.ok(zip.includes('assets/img_001_v2-a.png'));
assert.ok(!zip.includes('images/'), '自定义目录时 ZIP 里不应再出现默认目录');

// 非法目录不会拼出奇怪的路径
const fallback = applyImageResults('![](images/img_001_v2-a.jpg)', images, [{ ok: true, data: PNG }], '../evil');
assert.equal(fallback.content, '![](images/img_001_v2-a.png)');

console.log('image dir tests passed');
