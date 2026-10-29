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
  assert.ok(nws($('feedback-hint')).includes('第 2 页') && nws($('feedback-hint')).includes('重新导出'));
  assert.ok(nws($('feedback-img')).includes('123 张图片') && nws($('feedback-img')).includes('未能下载') && nws($('feedback-img')).includes('在线链接'));
}
{
  const { $, click } = await run({ success: true, downloadId: 9, filename: 'q.md', failedImages: 2, keptImages: 1 },
    () => ({ success: true, data: { filename: 'q.md', content: '#' } }));
  await click();
  assert.deepEqual(nws($('info-text')), ['2 张图片', '未能下载', '在线链接']);
  assert.equal($('info-text').textContent, '2 张图片未能下载，已保留在线链接');
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
assert.match(fs.readFileSync(new URL('../popup/popup.css', import.meta.url), 'utf8'), /\.alert \.nw\{white-space:nowrap\}/);
console.log('popup r05 nowrap tests passed');
