// batch6 ZB5-03：回答页正文里的「<尖括号>」不应导出成「<尖括号\>」，与专栏页一致
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const parsed = parseHTML('<!doctype html><html><body><div id="split"></div><div id="whole"></div></body></html>');
globalThis.window = parsed.window;
globalThis.document = parsed.document;
const { createTurndownService } = await import('../content/modules/turndown-rules.js');
const { ArticleExporter } = await import('../content/modules/exporters/article.js');

const doc = parsed.document;
// 回答页：同一行文字被拆成多个文本节点（React 渲染 / innerHTML 解析 API 正文时常见）
const split = doc.getElementById('split');
for (const [tag, parts] of [['h2', ['井号 ', '<', '尖括号', '>', ' 竖线']], ['p', ['正文 ', '<', 'T', '>', ' 泛型']]]) {
  const el = doc.createElement(tag);
  for (const t of parts) el.appendChild(doc.createTextNode(t));
  split.appendChild(el);
}
// 专栏页：同样内容是一个文本节点
const whole = doc.getElementById('whole');
whole.innerHTML = '<h2></h2><p></p>';
whole.querySelector('h2').textContent = '井号 <尖括号> 竖线';
whole.querySelector('p').textContent = '正文 <T> 泛型';

const md = (el) => createTurndownService(false).turndown(ArticleExporter.preprocessContainer(el));
const answer = md(split);
const column = md(whole);
assert.equal(column, '## 井号 <尖括号> 竖线\n\n正文 \\<T> 泛型'); // batch7 ZB6-03：<T> 写成 \<T>
assert.equal(answer, column);
assert.doesNotMatch(answer, /\\>/);
// 行首的「>」仍要转义（否则会被当成引用块），合并文本节点不影响这条
const q = doc.createElement('div');
q.innerHTML = '<p></p>';
q.firstChild.appendChild(doc.createTextNode('>'));
q.firstChild.appendChild(doc.createTextNode(' 不是引用'));
assert.equal(md(q), '\\> 不是引用');
console.log('angle brackets: answer page matches column page passed');
