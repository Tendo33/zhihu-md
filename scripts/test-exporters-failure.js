// 4 个导出器“找不到内容”时都要走 failureResult，返回带 reason 的失败结果；
// 正文里写着“安全验证”“登录后查看”的正常页面要照常导出。
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { FAILURE_MESSAGES } from '../lib/failure-reason.js';

globalThis.chrome = { storage: { sync: { get: (defaults, cb) => cb({ ...defaults, maxAnswerCount: 1 }) } } };
globalThis.fetch = async () => { throw new TypeError('offline in test'); };

function setPage(url, body, title = '知乎') {
  const { window, document } = parseHTML(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
  const location = new URL(url);
  window.scrollTo = () => {};
  Object.defineProperty(window, 'location', { value: location, configurable: true });
  globalThis.window = window;
  globalThis.document = document;
  Object.defineProperty(globalThis, 'location', { value: location, configurable: true, writable: true });
}

const { ArticleExporter } = await import('../content/modules/exporters/article.js');
const { QuestionExporter } = await import('../content/modules/exporters/question.js');
const { HotExporter } = await import('../content/modules/exporters/hot.js');
const { FeedExporter } = await import('../content/modules/exporters/feed.js');

const LOGIN_MODAL = '<div class="Modal"><div class="SignFlow">手机号登录</div></div>';
const expectLogin = (r, name) => assert.deepEqual(
  { success: r.success, reason: r.reason, error: r.error },
  { success: false, reason: 'login_required', error: FAILURE_MESSAGES.login_required },
  name,
);

setPage('https://zhuanlan.zhihu.com/p/123', LOGIN_MODAL);
expectLogin(ArticleExporter.getArticleInfo(), 'ArticleExporter.getArticleInfo');
expectLogin(await ArticleExporter.exportMarkdown(false), 'ArticleExporter.exportMarkdown');

setPage('https://www.zhihu.com/question/1', LOGIN_MODAL);
expectLogin(await QuestionExporter.exportMultipleAnswers(false), 'QuestionExporter.exportMultipleAnswers');

setPage('https://www.zhihu.com/hot', LOGIN_MODAL);
expectLogin(await HotExporter.exportHotList(), 'HotExporter.exportHotList');

setPage('https://www.zhihu.com/', LOGIN_MODAL);
expectLogin(await FeedExporter.exportFeedItems('home'), 'FeedExporter.exportFeedItems');

// 发版 QA ZR-06：热榜 front matter 的 url 与其他导出器一样加引号
setPage('https://www.zhihu.com/hot?list=total#a', '<div class="HotItem"><div class="HotItem-rank">1</div><a href="https://www.zhihu.com/question/1" title="热榜问题一号"><h2 class="HotItem-title">热榜问题一号</h2></a></div>');
{
  const hot = await HotExporter.exportHotList();
  assert.equal(hot.success, true);
  assert.match(hot.data.content, /^url: "https:\/\/www\.zhihu\.com\/hot\?list=total#a"$/m);
}

// 安全验证（标题）也经由导出器透出
setPage('https://zhuanlan.zhihu.com/p/123', '<div id="root"></div>', '安全验证 - 知乎');
assert.equal((await ArticleExporter.exportMarkdown(false)).reason, 'security_check');

// 正文含这些字样的正常文章：照常转换
setPage('https://zhuanlan.zhihu.com/p/123',
  '<h1 class="Post-Title">如何应对安全验证</h1><div class="Post-RichText"><p>系统检测到您的网络异常时会弹出安全验证，请完成验证；登录后查看更多。</p></div>');
const ok = await ArticleExporter.exportMarkdown(false);
assert.equal(ok.success, true, '正文提到安全验证不应判为失败');
assert.match(ok.data.content, /系统检测到您的网络异常时会弹出安全验证/);

console.log('exporter failure wiring tests passed');
