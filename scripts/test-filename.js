import assert from 'assert';
import { cleanFilename, normalizeUrl, querySelectorAny } from '../content/modules/constants.js';
import { ArticleExporter } from '../content/modules/exporters/article.js';

assert.strictEqual(cleanFilename('a\u0001b:c/d'), 'ab_c_d');
assert.strictEqual(cleanFilename(''), 'zhihu-article');
assert.strictEqual(cleanFilename('   '), 'zhihu-article');
assert.strictEqual(normalizeUrl('/question/1'), 'https://www.zhihu.com/question/1');
assert.strictEqual(normalizeUrl('//pic.zhimg.com/a.jpg'), 'https://pic.zhimg.com/a.jpg');

const parent = {
  querySelector(selector) {
    if (selector === '.second') return { found: true };
    return null;
  }
};
assert.deepStrictEqual(querySelectorAny(parent, ['.missing', '.second']), { found: true });
assert.strictEqual(querySelectorAny(parent, ['.missing']), null);

const frontMatter = ArticleExporter.generateFrontMatter('Say "hi"', '作者', 'https://zhuanlan.zhihu.com/p/1', '2020-01-01', '');
assert.match(frontMatter, /title: "Say \\"hi\\""/);
assert.match(frontMatter, /author: 作者/);
assert.match(frontMatter, /created: 2020-01-01/);
assert.doesNotMatch(frontMatter, /edited:/);

console.log('filename and front matter assertions passed');
