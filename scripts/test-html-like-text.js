// batch7 ZB6-03：正文里像 HTML 标签的尖括号（<T>、<div>…</div>）导出成 \<，在 html:true 的渲染器里仍可见；
// 代码块、行内代码、公式原样；行首 > 仍转义；不重新引入 ZB5-03 去掉的 \>。回答 / 专栏 / 问题页走同一套 turndown，结果一致。
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const parsed = parseHTML('<!doctype html><html><body><div id="c"></div></body></html>');
globalThis.window = parsed.window;
globalThis.document = parsed.document;
const { createTurndownService } = await import('../content/modules/turndown-rules.js');
const { ArticleExporter } = await import('../content/modules/exporters/article.js');
const doc = parsed.document;

// 与 QA 合成页 zhuanlan/p/6001 相同的结构（textContent 写入 = 页面上看到的字面文字）
const body = doc.getElementById('c');
const add = (tag, text, attrs = {}) => {
  const el = doc.createElement(tag);
  if (text != null) el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  body.appendChild(el);
  return el;
};
add('h2', '标题 <尖括号> 结尾');
add('p', '正文 <T> 泛型，a < b > c，<div>标签</div>，注释 <!-- x --> 结束');
add('p', '> 行首大于号不是引用');
const pre = add('pre');
const code = doc.createElement('code');
code.className = 'language-java';
code.textContent = 'List<String> xs = a < b > c ? f() : g(); <div>';
pre.appendChild(code);
const p1 = add('p', '行内代码 ');
const c1 = doc.createElement('code'); c1.textContent = 'Map<K, V> <br>'; p1.appendChild(c1);
p1.appendChild(doc.createTextNode(' 结束'));
const p2 = add('p', '行内公式 ');
const m1 = doc.createElement('span'); m1.className = 'ztext-math'; m1.setAttribute('data-tex', 'a<b>c<div>'); m1.textContent = 'a<b>c<div>'; p2.appendChild(m1);
p2.appendChild(doc.createTextNode(' 结束'));

const md = createTurndownService(false).turndown(ArticleExporter.preprocessContainer(body));
const lines = md.split('\n');
assert.ok(lines.includes('## 标题 <尖括号> 结尾'), md);
assert.ok(lines.includes('正文 \\<T> 泛型，a < b > c，\\<div>标签\\</div>，注释 \\<!-- x --> 结束'), md);
assert.ok(lines.includes('\\> 行首大于号不是引用'), md); // 行首 > 仍转义
assert.doesNotMatch(md.replace(/^\\> /m, ''), /\\>/); // 其余位置不出现 \>
assert.ok(md.includes('List<String> xs = a < b > c ? f() : g(); <div>'), md); // 代码块原样
assert.ok(md.includes('`Map<K, V> <br>`'), md); // 行内代码原样
assert.ok(md.includes('$a<b>c<div>$'), md); // 公式原样

// 渲染校验：markdown-it html:true（仓库不依赖 markdown-it：优先本仓库 node_modules，其次 MD_RENDERER_DIR / E2E_PLAYWRIGHT_DIR）
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let MarkdownIt = null;
for (const d of [root, process.env.MD_RENDERER_DIR, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
  try { MarkdownIt = createRequire(path.join(d, 'package.json'))('markdown-it'); break; } catch { /* next */ }
}
const prose = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').replace(/\$[^$]*\$/g, '');
if (MarkdownIt) {
  const html = new MarkdownIt({ html: true }).render(md);
  assert.match(html, /正文 &lt;T&gt; 泛型，a &lt; b &gt; c，&lt;div&gt;标签&lt;\/div&gt;，注释 &lt;!-- x --&gt; 结束/, html);
  assert.match(html, /<p>&gt; 行首大于号不是引用<\/p>/, html);
  assert.match(html, /List&lt;String&gt;/, html);
  assert.match(html, /<code>Map&lt;K, V&gt; &lt;br&gt;<\/code>/, html);
  assert.doesNotMatch(html, /<T>|<div>标签/, html);
  console.log('html-like text: markdown-it html:true render check passed');
} else {
  // 等价兜底：CommonMark 的 raw HTML 起始形态（<tag、</tag、<!）在代码/公式之外不得出现未转义的
  assert.doesNotMatch(prose, /(^|[^\\])<(?:[A-Za-z]|\/[A-Za-z]|!)/, prose);
  console.log('html-like text: markdown-it 未安装，按 CommonMark raw HTML 规则做等价检查 passed（设置 MD_RENDERER_DIR 可用 markdown-it 渲染）');
}
assert.doesNotMatch(prose, /(^|[^\\])<(?:[A-Za-z]|\/[A-Za-z]|!)/, prose);
console.log('html-like text tests passed');
