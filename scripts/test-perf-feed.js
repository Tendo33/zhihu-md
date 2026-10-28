// R3 perf：recordFromFeed 每条 API 回答只解析一次 HTML；构建只带 manifest 引用的图标且开启 minify
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
globalThis.Node = window.Node; globalThis.NodeFilter = window.NodeFilter;
const { QuestionExporter } = await import('../content/modules/exporters/question.js');
let parses = 0;
const orig = document.createElement.bind(document);
document.createElement = (tag) => {
  const el = orig(tag);
  if (tag === 'div') {
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Object.getPrototypeOf(el)), 'innerHTML')
      || Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML');
    Object.defineProperty(el, 'innerHTML', { get() { return d.get.call(this); }, set(v) { parses++; d.set.call(this, v); } });
  }
  return el;
};
const td = { turndown: (n) => n.textContent.trim() };
const rec = await QuestionExporter.recordFromFeed(
  { id: 1, content: '<p>你好，世界</p>', author: { name: 'a' }, created_time: 1700000000 }, '9', td, new Map());
assert.equal(rec.content, '你好，世界');
assert.equal(parses, 1, 'API 正文只解析一次');

const build = fs.readFileSync(new URL('./build.js', import.meta.url), 'utf8');
assert.match(build, /minify: true/);
assert.match(build, /usedIcons/);
console.log('perf feed tests passed');
