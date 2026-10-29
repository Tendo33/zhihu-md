// 第三轮设计：「已保存」文件名单行、中间省略保住后缀
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { splitFilename } from '../lib/filename-split.js';

assert.deepEqual(splitFilename('标题_with_images.zip'), ['标题', '_with_images.zip']);
assert.deepEqual(splitFilename('标题.md'), ['标题', '.md']);
assert.deepEqual(splitFilename('合集-20篇.zip'), ['合集-20篇', '.zip']);
assert.deepEqual(splitFilename('a.b.c.md'), ['a.b.c', '.md']);
assert.deepEqual(splitFilename('没有后缀'), ['没有后缀', '']);
assert.deepEqual(splitFilename('.md'), ['.md', '']);
assert.deepEqual(splitFilename(''), ['', '']);
assert.deepEqual(splitFilename(undefined), ['', '']);
for (const n of ['x_with_images.zip', '很长的标题 v2.0 说明.md', 'a']) assert.equal(splitFilename(n).join(''), n, '拼回原名');

const css = fs.readFileSync(new URL('../popup/popup.css', import.meta.url), 'utf8');
assert.match(css, /#ok-file\{display:flex;min-width:0\}/);
assert.match(css, /#ok-file \.fn-stem\{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis\}/);
assert.match(css, /#ok-file \.fn-suffix\{flex:none;white-space:nowrap\}/);

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
let n = 0;
async function run(bg) {
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://zhuanlan.zhihu.com/p/1', title: 'p' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? { success: true, data: { title: 'P', author: '' } } : { success: true, data: { filename: 'p.md', content: '#', images: [{ url: 'u', filename: 'f' }] } }), reload() {} },
    runtime: { sendMessage: async () => ({ success: true, downloadId: 5, ...bg }), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb({ ...d, downloadImages: true }) }, local: { get: async (d) => ({ ...d, recentExports: [] }), set: async () => {} } },
  };
  await import(`../popup/popup.js?fn${n++}`);
  await flush();
  document.getElementById('export-btn').dispatchEvent(new window.Event('click'));
  await flush();
  return document.getElementById('ok-file');
}
const LONG = '如何评价某某在二〇二六年发布的新一代大模型以及它对整个行业未来十年发展可能产生的深远影响';
for (const bg of [{ failedImages: 0 }, { failedImages: 2, keptImages: 1 }, { failedImages: 2 }]) {
  const el = await run({ filename: `${LONG}_with_images.zip`, ...bg });
  const kids = [...el.children];
  assert.deepEqual(kids.map((k) => [k.tagName, k.className]), [['SPAN', 'fn-stem'], ['SPAN', 'fn-suffix']], '两个 span');
  assert.equal(kids[0].textContent, LONG);
  assert.equal(kids[1].textContent, '_with_images.zip');
  assert.equal(el.getAttribute('title'), `${LONG}_with_images.zip`, 'title 全名');
  assert.equal(el.textContent, `${LONG}_with_images.zip`, 'textContent 全名');
}
console.log('filename split tests passed');
