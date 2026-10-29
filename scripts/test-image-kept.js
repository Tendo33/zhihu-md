// 第三轮 B（主管决定 + 设计定稿）：按规则保留在线链接的图片单独计数（kept），不算「N 张图片未能下载」
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
import { applyImageResults, imagePartialLine, imageKeptText, imageKeptMoreText, IMAGE_KEPT_REASON } from '../lib/image-pack.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SVG = new TextEncoder().encode('<svg/>');
const imgs = (n) => Array.from({ length: n }, (_, i) => ({ url: `https://pic1.zhimg.com/v2-${i}.png`, filename: `img_${i}.png` }));
const md = (list) => list.map((im) => `![](images/${im.filename})`).join('\n');

// 计数拆分
{
  const a = imgs(3);
  const onlyKept = applyImageResults(md(a), a, [{ ok: true, data: PNG }, { ok: false, kept: true }, { ok: true, data: SVG, contentType: 'image/svg+xml' }]);
  assert.deepEqual([onlyKept.failed, onlyKept.kept], [0, 2], '只有保留');
  const onlyFailed = applyImageResults(md(a), a, [{ ok: true, data: PNG }, { ok: false }, { ok: false }]);
  assert.deepEqual([onlyFailed.failed, onlyFailed.kept], [2, 0], '只有失败');
  const both = applyImageResults(md(a), a, [{ ok: false }, { ok: false, kept: true }, { ok: true, data: SVG }]);
  assert.deepEqual([both.failed, both.kept], [1, 2], '两者都有');
  assert.ok(!both.content.includes('](images/'), '失败和保留都回退在线链接');
}

// 文案（集中在 lib/image-pack.js）
assert.equal(imageKeptText(2), '2 张图片保留为在线链接');
assert.equal(imageKeptMoreText(2), '另有 2 张图片保留为在线链接');
assert.equal(imagePartialLine(1, 0), '1 张图片未能下载，已保留在线链接');
assert.equal(imagePartialLine(0, 2), '2 张图片保留为在线链接');
assert.equal(imagePartialLine(1, 2), '1 张图片未能下载，另有 2 张保留为在线链接');
assert.equal(imagePartialLine(0, 0), '');

// popup 场景
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
let n = 0;
async function runPopup(bg, data = {}) {
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://zhuanlan.zhihu.com/p/1', title: 'p' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? { success: true, data: { title: 'P', author: '' } } : { success: true, data: { filename: 'p.md', content: '#', images: [{ url: 'u', filename: 'f' }], ...data } }), reload() {} },
    runtime: { sendMessage: async () => ({ success: true, downloadId: 5, filename: 'p_with_images.zip', ...bg }), openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb({ ...d, downloadImages: true }) }, local: { get: async (d) => ({ ...d, recentExports: [] }), set: async () => {} } },
  };
  await import(`../popup/popup.js?kept${n++}`);
  await flush();
  document.getElementById('export-btn').dispatchEvent(new window.Event('click'));
  await flush();
  return (id) => document.getElementById(id);
}
const shown = (el) => !el.classList.contains('hidden');
{
  const $ = await runPopup({ failedImages: 0, keptImages: 2 });
  assert.ok(shown($('action-ok')), '只有保留：仍是成功提示');
  assert.ok(!shown($('action-info')), '只有保留：不加蓝色信息框');
  assert.ok(shown($('ok-kept')));
  assert.ok($('ok-kept').textContent.startsWith('2 张图片保留为在线链接'));
  assert.ok($('ok-kept').textContent.includes(IMAGE_KEPT_REASON), '读屏文字带原因');
  assert.equal($('ok-kept').getAttribute('title'), `2 张图片保留为在线链接：${IMAGE_KEPT_REASON}`);
  assert.ok($('ok-kept').closest('[role=status]') === $('action-ok'), '和「已保存」在同一个 status 区域');
}
{
  const $ = await runPopup({ failedImages: 3, keptImages: 0 });
  assert.ok(shown($('action-info')));
  assert.equal($('info-text').textContent, '3 张图片未能下载，已保留在线链接');
  assert.ok(!shown($('info-kept')) && !shown($('ok-kept')), '只有失败：没有保留行');
  assert.equal($('info-text').getAttribute('title'), null, '只有失败：不加 title');
  assert.equal($('action-info').getAttribute('title'), null);
}
{
  const $ = await runPopup({ failedImages: 1, keptImages: 2 });
  assert.equal($('info-text').textContent, '1 张图片未能下载，已保留在线链接', 'N 只算失败');
  // 设计定稿 B：保留数不上屏，视觉隐藏 span 放在 #action-info（role=status）里一起念；title 写全句
  const k = $('info-kept');
  assert.equal(k.textContent, '另有 2 张图片保留为在线链接', 'sr-only 文字');
  assert.ok(k.classList.contains('sr-only') && !k.classList.contains('img-sub'), '是视觉隐藏，不上屏');
  assert.ok(shown(k), '不是 display:none（没有 .hidden）');
  assert.ok($('action-info').contains(k) && $('action-info').getAttribute('role') === 'status', '在 #action-info 里');
  assert.equal($('info-text').getAttribute('title'), '1 张图片未能下载，另有 2 张保留为在线链接', 'title 全句，在可见文字 span 上');
  assert.equal($('action-info').getAttribute('title'), null, 'role=status 容器不带 title');
  const css = fs.readFileSync(new URL('../lib/ui-v2.css', import.meta.url), 'utf8').match(/\.sr-only\{[^}]*\}/)[0];
  assert.ok(!/display\s*:\s*none/.test(css) && /clip/.test(css), '.sr-only 是标准视觉隐藏写法');
  assert.ok(!shown($('ok-kept')), '绿色提示里不重复');
}
{
  const $ = await runPopup({ failedImages: 0, keptImages: 2 }, { partial: { exported: 3, total: 10, failedPage: 2 } });
  assert.ok($('action-feedback').classList.contains('warn'), 'ZR-02 琥珀提示');
  assert.ok(shown($('feedback-img')) && $('feedback-img').textContent.startsWith('2 张图片保留为在线链接'));
  assert.ok(!shown($('ok-kept')) && !shown($('action-info')));
}

// 悬浮球：只有 kept → 普通成功，tooltip 不变，读屏末尾补一句；有失败 → 沿用 ZR-09，读屏补「另有 M 张…」
{
  const { window, document } = parseHTML('<html><body></body></html>');
  globalThis.window = window; globalThis.document = document;
  const { FloatingBall } = await import('../content/modules/floating-ball.js?kept');
  const ball = document.createElement('div');
  ball.innerHTML = '<span class="face"></span><span class="tooltip"></span>';
  document.body.append(ball);
  FloatingBall.operation = 1;
  const realSetTimeout = globalThis.setTimeout; globalThis.setTimeout = () => 0;
  FloatingBall.finishBall(ball, 1, 'success', '已导出', imageKeptText(2));
  assert.equal(ball.querySelector('.tooltip').textContent, '已导出');
  assert.equal(document.getElementById('zhihu-md-live').textContent, '已导出，2 张图片保留为在线链接');
  assert.ok(ball.getAttribute('aria-label').includes('2 张图片保留为在线链接'));
  globalThis.setTimeout = realSetTimeout;
  const src = fs.readFileSync(new URL('../content/modules/floating-ball.js', import.meta.url), 'utf8');
  // 设计复核 4193502：只有保留时读屏补上原因
  assert.ok(src.includes('const srExtra = ballKeptSrExtra(failedN, keptN);'));
  const { ballKeptSrExtra, ballImageSrExtra } = await import('../content/modules/ball-text.js');
  const ip = await import('../lib/image-pack.js');
  assert.equal(ballKeptSrExtra(0, 2), `${ip.imageKeptText(2)}。${ip.IMAGE_KEPT_REASON}`);
  // QA e2fa5da P4：1 张时也读得通，原因单独成句
  assert.equal(ballKeptSrExtra(0, 1), '1 张图片保留为在线链接。图片格式或来源不支持保存到本地');
  assert.equal(ip.imagePartialSrExtra(0, 1), '1 张图片保留为在线链接。图片格式或来源不支持保存到本地');
  assert.equal(ballKeptSrExtra(1, 2), ip.imageKeptMoreShortText(2));
  assert.equal(ballKeptSrExtra(1, 0), '');
  for (const [f, k] of [[3, 0], [3, 2], [0, 5], [0, 0]]) assert.equal(ballImageSrExtra(f, k), ip.imagePartialSrExtra(f, k), `读屏补充 ${f}/${k} 与弹窗一致`);
}
console.log('image kept/failed split tests passed');
