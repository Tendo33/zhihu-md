import assert from 'assert';
import { parseHTML } from 'linkedom';
import { createTurndownService } from '../content/modules/turndown-rules.js';

const html = `
<article>
  <p>公式 <span class="ztext-math" data-tex="E=mc^2">E</span> 在句中。</p>
  <div class="ztext-math-container"><span class="ztext-math" data-tex="a+b">a+b</span></div>
  <pre><code class="language-python">print(1)</code></pre>
  <table><thead><tr><th>列</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
  <div class="LinkCard"><a href="https://example.com/post"><span class="LinkCard-title">卡片</span></a></div>
</article>
`;

const parsed = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
globalThis.window = parsed.window;
globalThis.document = parsed.document;
const markdown = createTurndownService(false).turndown(parsed.document.querySelector('article'));

assert.match(markdown, /\$E=mc\^2\$/);
assert.match(markdown, /\$\$\s*a\+b\s*\$\$/);
assert.match(markdown, /```python[\s\S]*print\(1\)[\s\S]*```/);
assert.match(markdown, /\| 列 \|/);
assert.match(markdown, /\[卡片\]\(https:\/\/example.com\/post\)/);

const withImages = createTurndownService(true);
withImages.turndown(parseHTML('<!doctype html><html><body><img src="https://pic.zhimg.com/a.jpg" alt="图"></body></html>').document.body);
assert.strictEqual(withImages.imageCollector.images.length, 1);
assert.match(withImages.imageCollector.images[0].filename, /\.jpg$/);

console.log('markdown fixture assertions passed');
