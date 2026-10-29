// 设计复核 935b5b5：部分导出时「打开」在琥珀提示里（#feedback-open），绿色「已保存」不再出现
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
let n = 0;
async function run(bgRes, exportResFn) {
  const html = fs.readFileSync(new URL('../popup/popup.html', import.meta.url), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const { window, document } = parseHTML(html);
  globalThis.window = window; globalThis.document = document;
  const shown = [];
  let call = 0;
  globalThis.chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://www.zhihu.com/question/1', title: 'q' }], sendMessage: async (id, m) => (m.action === 'getArticleInfo' ? { success: true, data: { title: 'Q', author: '' } } : exportResFn(call++)), reload() {} },
    runtime: { sendMessage: async () => bgRes, openOptionsPage() {}, getURL: (p) => p, getManifest: () => ({ version: '0' }) },
    commands: { getAll: async () => [] },
    downloads: { show: (id) => shown.push(id) },
    storage: { sync: { get: (d, cb) => cb(d) }, local: { get: async (d) => ({ ...d, recentExports: [] }), set: async () => {} } },
  };
  await import(`../popup/popup.js?fo${n++}`);
  await flush();
  const $ = (id) => document.getElementById(id);
  const click = async () => { $('export-btn').dispatchEvent(new window.Event('click')); await flush(); };
  return { $, click, shown, window };
}
const partial = () => ({ success: true, data: { filename: 'q.md', content: '#', partial: { exported: 3, total: 10, failedPage: 2 } } });
const hidden = (el) => el.classList.contains('hidden');
{
  const { $, click, shown, window } = await run({ success: true, downloadId: 9, filename: 'q.md' }, partial);
  await click();
  assert.ok(hidden($('action-ok')), '部分导出：#action-ok 隐藏');
  assert.ok(!hidden($('feedback-open')), '有 downloadId：#feedback-open 显示');
  assert.ok($('feedback-open').closest('#action-feedback'), '按钮在琥珀提示里');
  $('feedback-open').dispatchEvent(new window.Event('click'));
  assert.deepEqual(shown, [9], '复用「打开」的处理函数');
}
{
  const { $, click } = await run({ success: true, filename: 'q.md' }, partial);
  await click();
  assert.ok(hidden($('feedback-open')), '没有 downloadId：不显示');
}
{
  // 先部分导出，再一次失败 → error 色调下隐藏
  const { $, click } = await run({ success: true, downloadId: 9, filename: 'q.md' }, (i) => (i === 0 ? partial() : { success: false, error: 'x', reason: 'not_ready' }));
  await click();
  assert.ok(!hidden($('feedback-open')));
  await click();
  assert.ok($('action-feedback').classList.contains('err'), '第二次是错误');
  assert.ok(hidden($('feedback-open')), 'error 时隐藏');
}
{
  // 成功导出不出现 #feedback-open
  const { $, click } = await run({ success: true, downloadId: 9, filename: 'q.md' }, () => ({ success: true, data: { filename: 'q.md', content: '#' } }));
  await click();
  assert.ok(!hidden($('action-ok')) && hidden($('feedback-open')));
}
console.log('feedback open button tests passed');
