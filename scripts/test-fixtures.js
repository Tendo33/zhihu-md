// 用裁剪后的真实知乎正文片段做转换质量快照测试。
// 更新快照：UPDATE_SNAPSHOTS=1 node scripts/test-fixtures.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { createTurndownService, tidyMarkdown } from '../content/modules/turndown-rules.js';
import { extractHotItems, findAnswerItem } from '../content/modules/zhihu-dom.js';

const FIX = new URL('../tests/fixtures/', import.meta.url);
const SNAP = new URL('../tests/snapshots/', import.meta.url);
const update = process.env.UPDATE_SNAPSHOTS === '1';

function load(name) {
  const parsed = parseHTML(fs.readFileSync(new URL(name, FIX), 'utf8'));
  globalThis.window = parsed.window;
  globalThis.document = parsed.document;
  return parsed.document;
}

function snapshot(name, markdown) {
  const file = new URL(`${name}.md`, SNAP);
  if (update || !fs.existsSync(file)) {
    fs.writeFileSync(file, markdown + '\n');
    return;
  }
  assert.equal(markdown + '\n', fs.readFileSync(file, 'utf8'), `快照不一致：${name}（确认后用 UPDATE_SNAPSHOTS=1 更新）`);
}

function common(name, md) {
  assert.doesNotMatch(md, /data:image/, `${name}: 不应输出占位图`);
  assert.equal(md, tidyMarkdown(md), `${name}: 代码块外不应有空白行/连续空行`);
  assert.doesNotMatch(md, /\]\(\/\//, `${name}: 链接需补全协议`);
  assert.doesNotMatch(md, /link\.zhihu\.com\/\?target=/, `${name}: 跳转链接需解开`);
}

const convert = (root) => createTurndownService(false).turndown(root).trim();

// 公式
{
  const doc = load('answer-latex.html');
  const item = findAnswerItem(doc, '1260166810');
  assert.ok(item, '按 .AnswerItem[name] 找到目标回答');
  const md = convert(item.querySelector('.RichText'));
  const texCount = item.querySelectorAll('.ztext-math').length;
  const mathCount = (md.match(/\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g) || []).length;
  assert.equal(mathCount, texCount, '每个 data-tex 公式都输出为 $…$');
  assert.match(md, /\$\$e\^\{iz\}=\\cos z\+i\\sin z\$\$/);
  common('answer-latex', md);
  snapshot('answer-latex', md);
}

// 代码
{
  const doc = load('answer-code.html');
  const md = convert(findAnswerItem(doc, '3278589663').querySelector('.RichText'));
  const fences = (md.match(/^```/gm) || []).length;
  assert.equal(fences, doc.querySelectorAll('pre').length * 2, '每个 pre 都成为成对的代码围栏');
  assert.match(md, /```python3\nfrom PIL import Image, ImageFont, ImageDraw/);
  assert.doesNotMatch(md, /<span class="(?:kn|nn|k)">/, '代码高亮 span 被剥掉');
  assert.match(md, /ImageDraw\n\n\ndef watermark_Image/, '代码块里的连续空行原样保留');
  common('answer-code', md);
  snapshot('answer-code', md);
}

// 长文
{
  const doc = load('answer-long.html');
  const md = convert(findAnswerItem(doc, '2571795386').querySelector('.RichText'));
  assert.ok(md.length > 30000, '长文完整输出');
  assert.equal((md.match(/!\[[^\]]*\]\(https:\/\/pic/g) || []).length, doc.querySelectorAll('figure img').length, '每张图都输出');
  assert.match(md, /^## 准备工作$/m, '标题里不留多余 **');
  assert.match(md, /\]\(https:\/\/www\.zhihu\.com\/people\//, '协议相对链接补全为 https');
  common('answer-long', md);
  snapshot('answer-long', md);
}

// 表格
{
  const doc = load('article-tables.html');
  const md = convert(doc.querySelector('.Post-RichText'));
  const separators = (md.match(/^\| (?:--- \| )*--- \|$/gm) || []).length;
  assert.equal(separators, doc.querySelectorAll('table').length, '每张表都输出 GFM 表头分隔行');
  assert.match(md, /\| 1 \| MiniMax M3 \| 59\.0% \|/);
  common('article-tables', md);
  snapshot('article-tables', md);
}

// 问题页多回答
{
  const doc = load('question-multi.html');
  const service = createTurndownService(false);
  const parts = ['1334631491', '1261862523', '1266832607'].map((id) => {
    const item = findAnswerItem(doc, id);
    assert.ok(item, `回答 ${id}`);
    return service.turndown(item.querySelector('.RichText')).trim();
  });
  assert.equal(parts.length, 3);
  parts.forEach((p) => assert.ok(p.length > 0));
  const md = parts.join('\n\n---\n\n');
  common('question-multi', md);
  snapshot('question-multi', md);
}

// 热榜
{
  const doc = load('hot.html');
  const items = extractHotItems(doc);
  assert.equal(items.length, 10);
  items.forEach((it, i) => {
    assert.equal(it.rank, String(i + 1));
    assert.ok(it.title.length > 3);
    assert.match(it.url, /^https:\/\/www\.zhihu\.com\/question\/\d+$/);
  });
  snapshot('hot', items.map((it) => `${it.rank}. [${it.title}](${it.url}) ${it.metrics}`.trim()).join('\n'));
}

// 参考脚注（手写 fixture）
{
  const doc = load('footnote.html');
  const md = convert(doc.querySelector('.RichText'));
  assert.match(md, /2017 年\[\^1\]，后来 BERT 沿用了编码器结构\[\^2\]。/);
  assert.match(md, /再次引用第一篇\[\^1\]/, '同一文献复用编号');
  assert.match(md, /^\[\^1\]: Attention Is All You Need https:\/\/arxiv\.org\/abs\/1706\.03762$/m);
  assert.match(md, /^\[\^3\]: 作者私下交流$/m);
  assert.equal((md.match(/^\[\^\d+\]:/gm) || []).length, 3);
  assert.doesNotMatch(md, /^1\.\s+Attention/m, '页面自带参考列表不重复输出');
  assert.match(md, /x<sup>2<\/sup>/);
  common('footnote', md);
  snapshot('footnote', md);
}

console.log(`fixture snapshot tests passed${update ? ' (snapshots updated)' : ''}`);

// 隐私：fixture 和快照里不留第三方用户主页 ID
for (const dir of [FIX, SNAP]) {
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(text, /zhihu\.com\/people\/(?!placeholder\b)[\w-]+/, `${f}: 用户主页链接应为占位`);
  }
}
