// 设计 R05 / R09：弹窗中文状态文案的词组和“数字+量词”包进 .nw，320 宽不再出现「条未能加/载」
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
let n = 0;
async function run(bgRes, exportResFn, info = { success: true, data: { title: 'Q', author: '' } }) {
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  let call = 0;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://www.zhihu.com/question/1', title: 'q' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? info : exportResFn(call++)), reload() {} },
    runtime: { sendMessage: async () => bgRes, openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show() {} },
    storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => ({ ...d, recentExports: [] }), set: async () => {} } },
  };
  await import(`../popup/popup.js?nw${n++}`);
  await flush();
  const $ = (id) => document.getElementById(id);
  const click = async () => { $('export-btn').dispatchEvent(new window.Event('click')); await flush(); };
  return { $, click };
}
const nws = (el) => [...el.querySelectorAll('.nw')].map((x) => x.textContent);
{
  const { $, click } = await run({ success: true, downloadId: 9, filename: 'q.md', failedImages: 123, keptImages: 0 },
    () => ({ success: true, data: { filename: 'q.md', content: '#', partial: { exported: 3, total: 10, failedPage: 2 } } }));
  await click();
  const t = $('feedback-title');
  assert.equal(t.textContent, '已导出 3/10 条，7 条未能加载', 'textContent 不变');
  assert.ok(nws(t).includes('未能加载'), `「未能加载」在 .nw 里：${nws(t)}`);
  assert.ok(nws(t).includes('3/10 条') && nws(t).includes('7 条'), '数字和量词不拆开');
  assert.ok(nws($('feedback-hint')).includes('第 2 页') && nws($('feedback-hint')).includes('可稍后重新导出'));
  // 设计验收必改 2：320 宽「文件已保/存」「可稍/后」被拆开
  assert.equal($('feedback-hint').textContent, '第 2 页起加载失败，文件已保存，可稍后重新导出');
  assert.ok(nws($('feedback-hint')).includes('文件已保存，') && nws($('feedback-hint')).includes('可稍后重新导出'), `${nws($('feedback-hint'))}`);
  // 徽标也走 .nw（设计验收建议）
  assert.equal(globalThis.document.querySelector('.status-text').textContent, '部分导出');
  assert.deepEqual(nws($('feedback-img')), ['123 张图片未能下载，', '在线链接'], '只有 f：句子不变，长串在前');
}
{
  const { $, click } = await run({ success: true, downloadId: 9, filename: 'q.md', failedImages: 2, keptImages: 1 },
    () => ({ success: true, data: { filename: 'q.md', content: '#' } }));
  await click();
  // PM 定稿 2026-10-29：合并句只允许在逗号后折行
  assert.deepEqual(nws($('info-text')), ['2 张图片未能下载，', '1 张不支持保存，', '均已保留在线链接']);
  assert.equal($('info-text').textContent, '2 张图片未能下载，1 张不支持保存，均已保留在线链接');
  // 逗号之间的文字全在 .nw 里（无可折行的空隙）
  const loose = [...$('info-text').childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('');
  assert.equal(loose, '', `整句都在 .nw 里，只在逗号后折行：「${loose}」`);
}
{
  const { $, click } = await run({ success: true, downloadId: 9, filename: 'q.md', failedImages: 123, keptImages: 1000 },
    () => ({ success: true, data: { filename: 'q.md', content: '#', partial: { exported: 3, total: 10, failedPage: 2 } } }));
  await click();
  assert.equal($('feedback-img').textContent, '123 张图片未能下载，1000 张不支持保存，均已保留在线链接');
  const loose = [...$('feedback-img').childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('');
  assert.equal(loose, '', `partial：整句都在 .nw 里：「${loose}」`);
  for (const n of ['1 张图片未能下载，', '12345 张不支持保存，']) assert.ok(n.match(/\d+ 张图片未能下载，|\d+ 张不支持保存，/), n);
  assert.equal($('feedback-img').querySelector('.sr-only'), null);
  assert.equal($('feedback-img').getAttribute('title'), null);
}
{
  const { $, click } = await run({ success: true }, () => ({ success: false, error: 'x', reason: 'not_loaded' }));
  await click();
  assert.equal($('action-feedback').getAttribute('role'), 'alert');
  const all = [...nws($('feedback-title')), ...nws($('feedback-hint'))];
  assert.ok(all.includes('未加载完') && all.includes('刷新页面'), `失败文案：${all}`);
}
// 矩阵 failed-err（login_required）320 宽实测「请登/录后」被拆开：登录、验证、限流也不从中间折行
for (const reason of ['login_required', 'security_check']) {
  const { $, click } = await run({ success: true }, () => ({ success: false, error: 'x', reason }));
  await click();
  const all = [...nws($('feedback-title')), ...nws($('feedback-hint'))];
  const txt = $('feedback-title').textContent + $('feedback-hint').textContent;
  for (const w of ['登录', '验证', '限流']) if (txt.includes(w)) assert.ok(all.includes(w), `${reason}：「${w}」应在 .nw 里（${all}）`);
  assert.ok(all.length > 0, reason);
}
{
  const { $ } = await run({ success: true }, () => ({}), { success: false, reason: 'not_loaded' });
  assert.ok(!$('action-info').classList.contains('hidden'));
  assert.equal($('action-hint').textContent, '暂不可导出，原因见下方提示');
}
assert.match(fs.readFileSync(new URL('../popup/popup.css', import.meta.url), 'utf8'), /(^|\n)\.nw\{white-space:nowrap\}/);
// 设计 R17（800% 缩放）：头部图标 24px 显示，源图用 icon128（48px 在 8x 下发虚）；只换分辨率来源
{
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="logo"><img src="\.\.\/icons\/icon128\.png" alt="" width="24" height="24"><\/div>/);
  const png = fs.readFileSync(new URL('../icons/icon128.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 128);
}
console.log('popup r05 nowrap tests passed');
