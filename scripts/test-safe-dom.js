// web-ext UNSAFE_VAR_ASSIGNMENT：外部 HTML 解析到惰性文档，静态图标用 DOM API 构建，源码里不再有 innerHTML 赋值
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
const { parseHtmlInert, svgIcon } = await import('../lib/safe-dom.js');

const h = parseHtmlInert('<p>你好<img src="x" onerror="alert(1)"></p><script>bad()</script>');
assert.notEqual(h.ownerDocument, document, '外部 HTML 不进当前页面文档');
assert.equal(h.querySelector('p').textContent, '你好');
assert.equal(parseHtmlInert('').childNodes.length, 0);

const s = svgIcon('check', 'icon');
assert.equal(s.getAttribute('class'), 'icon');
assert.equal(s.getAttribute('aria-hidden'), 'true');
assert.equal(s.querySelector('path').getAttribute('d'), 'M5 12l5 5L20 7');
assert.equal(svgIcon('alert').querySelectorAll('circle').length, 1);

for (const f of ['content/modules/floating-ball.js', 'content/modules/exporters/question.js',
  'content/modules/exporters/article.js', 'popup/popup.js']) {
  const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\.innerHTML\s*=(?!=)/, `${f} 不应再给 innerHTML 赋值`);
}
console.log('safe dom tests passed');
