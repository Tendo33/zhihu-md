// batch8 ZB7-01（f206396）：link.zhihu.com 跳转目标解码后重新编码成合法 URL；只接受 http/https，其余安全退回。
// 审查 P2（990aa02）：( ) 编码成 %28 / %29。审查 P3①：mailto 保留为链接，#锚点只留文字。
// batch8 ZB7-02 的相邻 LinkCard 用例在 81d9300 才加入（文件末尾）；f206396 里这行说明是提前写的。
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { loadMarkdownIt } from './lib/rendered-check.js';

const parsed = parseHTML('<!doctype html><html><body><div id="c"></div></body></html>');
globalThis.window = parsed.window;
globalThis.document = parsed.document;
const { createTurndownService, normalizeZhihuHref } = await import('../content/modules/turndown-rules.js');
const doc = parsed.document;
const md = (html) => {
  const box = doc.createElement('div');
  box.innerHTML = html;
  return createTurndownService().turndown(box).trim();
};
const enc = encodeURIComponent;
const redirect = (t) => `https://link.zhihu.com/?target=${enc(t)}`;

// --- ZB7-01 normalizeZhihuHref ---
const QA = 'https://link.zhihu.com/?target=https%3A//example.com/a_(b)%20c%3Fq%3D1%26r%3D%3Cx%3E';
assert.equal(normalizeZhihuHref(QA), 'https://example.com/a_%28b%29%20c?q=1&r=%3Cx%3E');
assert.equal(normalizeZhihuHref(redirect('https://example.com/x y')), 'https://example.com/x%20y');
assert.equal(normalizeZhihuHref(redirect('http://example.com/?q=<b>"')), 'http://example.com/?q=%3Cb%3E%22');
assert.equal(normalizeZhihuHref(redirect('https://example.com/?a=1&b=[2]')), 'https://example.com/?a=1&b=[2]');
// 非 http(s) 跳转目标：退回原跳转地址（本身是 https）
for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'not a url']) {
  const r = redirect(bad);
  assert.equal(normalizeZhihuHref(r), new URL(r).href.replace(/\(/g, '%28').replace(/\)/g, '%29'), bad);
}
assert.equal(normalizeZhihuHref('https://link.zhihu.com/?x=1'), 'https://link.zhihu.com/?x=1');
// 普通链接 / 相对链接
assert.equal(normalizeZhihuHref('//www.zhihu.com/q/1'), 'https://www.zhihu.com/q/1');
assert.equal(normalizeZhihuHref('/people/a b'), 'https://www.zhihu.com/people/a%20b');
assert.equal(normalizeZhihuHref('https://example.com/x_(y)?a=1&b=2'), 'https://example.com/x_%28y%29?a=1&b=2');
// 原链接不是 http(s)：返回 ''，调用方只留文字
for (const bad of ['javascript:alert(1)', 'data:,x', 'http://', '#sec', '#']) assert.equal(normalizeZhihuHref(bad), '', bad);

// --- 转换结果 ---
const card = (href, title) => `<a class="LinkCard" href="${href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"><span class="LinkCard-title">${title}</span></a>`;
assert.equal(md(card(QA, '卡片')), '[卡片](https://example.com/a_%28b%29%20c?q=1&r=%3Cx%3E)');
assert.equal(md(card('javascript:alert(1)', '坏卡片')), '坏卡片');
assert.equal(md('<p>见 <a href="javascript:alert(1)">这里</a> 结束</p>'), '见 这里 结束');
assert.equal(md(`<p><a href="${redirect('https://e.com/a b<c>')}">普通</a></p>`), '[普通](https://e.com/a%20b%3Cc%3E)');

// 真实渲染：markdown-it 识别为链接，且没有 raw HTML
const loaded = loadMarkdownIt();
if (loaded) {
  const it = new loaded.MarkdownIt({ html: true });
  const html = it.render(md(card(QA, '卡片')));
  assert.match(html, /<a href="https:\/\/example\.com\/a_%28b%29%20c\?q=1&amp;r=%3Cx%3E">卡片<\/a>/);
  assert.doesNotMatch(html, /<x>/);
  console.log(`link href: markdown-it ${loaded.version} render check passed`);
}

// --- 审查 P2：不成对括号编码成 %28 / %29，链接不被截断 ---
const PAREN = [
  ['https://a.com/b)c', 'https://a.com/b%29c'],
  ['https://a.com/(x', 'https://a.com/%28x'],
];
for (const [target, want] of PAREN) {
  assert.equal(normalizeZhihuHref(target), want, target);
  assert.equal(normalizeZhihuHref(redirect(target)), want, `redirect ${target}`);
  const outs = [md(`<p><a href="${redirect(target)}">文字</a></p>`), md(card(redirect(target), '卡片'))];
  assert.deepEqual(outs, [`[文字](${want})`, `[卡片](${want})`]);
  for (const out of outs) {
    // 兜底模式（无 markdown-it）也成立：链接地址里没有裸括号，结尾的 ) 就是链接结束
    assert.ok(!/[()]/.test(out.slice(out.indexOf('](') + 2, -1)), out);
    if (loaded) {
      const links = new loaded.MarkdownIt({ html: true }).parseInline(out, {})[0].children.filter((t) => t.type === 'link_open');
      assert.equal(links.length, 1, out);
      assert.equal(links[0].attrGet('href'), want, out);
    }
  }
}
console.log(`paren href: ${loaded ? `markdown-it ${loaded.version} link_open href ok` : 'fallback (no markdown-it) ok'}`);

// --- 审查 P3①（lead 决定）：mailto 保留为链接；#锚点有意只留文字 ---
assert.equal(normalizeZhihuHref('mailto:a@b.c'), 'mailto:a@b.c');
assert.equal(normalizeZhihuHref('MAILTO:a@b.c?subject=hi there'), 'mailto:a@b.c?subject=hi%20there');
assert.equal(normalizeZhihuHref('mailto:x(y)@b.c'), 'mailto:x%28y%29@b.c');
assert.equal(normalizeZhihuHref('mailto:'), '');
assert.equal(normalizeZhihuHref(redirect('mailto:a@b.c')), new URL(redirect('mailto:a@b.c')).href, '跳转目标仍只接受 http(s)');
assert.equal(md('<p>写信给 <a href="mailto:a@b.c">我</a></p>'), '写信给 [我](mailto:a@b.c)');
assert.equal(md('<p>见 <a href="#sec2">第二节</a> 和 <a href="#">顶部</a></p>'), '见 第二节 和 顶部');
assert.equal(md(card('#sec2', '锚点卡片')), '锚点卡片');
if (loaded) {
  const toks = new loaded.MarkdownIt({ html: true }).parseInline(md('<p><a href="mailto:x(y)@b.c?subject=a b">信</a></p>'), {})[0].children;
  assert.equal(toks.find((t) => t.type === 'link_open').attrGet('href'), 'mailto:x%28y%29@b.c?subject=a%20b');
}
console.log('mailto kept / #anchor text-only: ok');
console.log('link href tests passed');

// --- ZB7-02 相邻 LinkCard 各占一段 ---
{
  const two = md(card('https://example.com/a', '甲') + card('https://example.com/b', '乙'));
  assert.equal(two, '[甲](https://example.com/a)\n\n[乙](https://example.com/b)');
  const mixed = md('<p>前文</p>' + card('https://example.com/a', '甲') + card('javascript:alert(1)', '乙') + '<p>后文</p>');
  assert.equal(mixed, '前文\n\n[甲](https://example.com/a)\n\n乙\n\n后文');
  assert.ok(!/\n{3,}/.test(mixed), '不应出现多余空行');
  console.log('ZB7-02 adjacent LinkCards: ok');
}

// --- ZB8-01（lead 决定）：tel: 和 mailto 一样保留为链接；跳转目标仍只接受 http(s) ---
{
  assert.equal(normalizeZhihuHref('tel:+8610123'), 'tel:+8610123');
  assert.equal(normalizeZhihuHref('TEL:+86 10 123'), 'tel:+86%2010%20123');
  assert.equal(normalizeZhihuHref('tel:'), '');
  assert.equal(normalizeZhihuHref(redirect('tel:+8610123')), new URL(redirect('tel:+8610123')).href, 'tel: 跳转目标退回 link.zhihu.com');
  for (const bad of ['javascript:alert(1)', 'data:,x', 'vbscript:x', 'sms:+8610123', 'file:///etc/passwd']) {
    assert.equal(normalizeZhihuHref(bad), '', bad);
  }
  assert.equal(md('<p>电话 <a href="tel:+8610123">T-tel</a></p>'), '电话 [T-tel](tel:+8610123)');
  assert.equal(md('<p><a href="#ref1">A-anchor</a></p>'), 'A-anchor');
  assert.equal(normalizeZhihuHref('mailto:a@b.c'), 'mailto:a@b.c');
  if (loaded) {
    const toks = new loaded.MarkdownIt({ html: true }).parseInline(md('<p><a href="tel:+86 (10) 123">电</a></p>'), {})[0].children;
    assert.equal(toks.find((t) => t.type === 'link_open').attrGet('href'), 'tel:+86%20%2810%29%20123');
  }
  console.log('ZB8-01 tel kept / redirect-to-tel falls back: ok');
}
