// batch5：标题里不转义有序列表前缀；正文段落行首仍转义；「1)」「-」「+」行为不变
import assert from 'assert';
import { parseHTML } from 'linkedom';
import { createTurndownService } from '../content/modules/turndown-rules.js';

function md(body) {
  const parsed = parseHTML(`<!doctype html><html><body><article>${body}</article></body></html>`);
  globalThis.window = parsed.window;
  globalThis.document = parsed.document;
  return createTurndownService(false).turndown(parsed.document.querySelector('article'));
}

// 标题：不转义
assert.strictEqual(md('<h2>1. 先记结论</h2>'), '## 1. 先记结论');
assert.strictEqual(md('<h3>12. 第十二条</h3>'), '### 12. 第十二条');
assert.strictEqual(md('<h2><strong>2. 加粗标题</strong></h2>'), '## 2. 加粗标题');
// 标题里其它位置的「1. 」本来就不转义，保持不变
assert.strictEqual(md('<h2>第 1. 节</h2>'), '## 第 1. 节');

// 正文段落行首：仍然转义（否则会被当成有序列表）
assert.strictEqual(md('<p>1. 先记结论</p>'), '1\\. 先记结论');
assert.strictEqual(md('<h2>标题</h2><p>3. 正文</p>'), '## 标题\n\n3\\. 正文');

// 其它前缀：行为与修复前一致
assert.strictEqual(md('<p>1) 括号</p>'), '1) 括号');
assert.strictEqual(md('<h2>1) 括号</h2>'), '## 1) 括号');
assert.strictEqual(md('<p>- 减号</p>'), '\\- 减号');
assert.strictEqual(md('<h2>- 减号</h2>'), '## \\- 减号');
assert.strictEqual(md('<p>+ 加号</p>'), '\\+ 加号');
assert.strictEqual(md('<h2>+ 加号</h2>'), '## \\+ 加号');

console.log('heading escape tests passed');
