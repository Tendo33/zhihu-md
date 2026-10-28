import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { diagnoseFailure, failureResult, FAILURE_MESSAGES } from '../lib/failure-reason.js';

const doc = (html, title = '') => {
  const { document } = parseHTML(`<!doctype html><html><head><title>${title}</title></head><body>${html}</body></html>`);
  return document;
};

const cases = [
  ['安全验证页（URL）', doc('<div>请稍候</div>'), 'https://www.zhihu.com/account/unhuman?type=unhuman', 'security_check'],
  ['安全验证页（标题）', doc('<div id="root"></div>', '安全验证 - 知乎'), 'https://www.zhihu.com/question/1', 'security_check'],
  ['安全验证页（验证码节点）', doc('<div class="Unhuman"><div class="yidun"></div></div>'), 'https://www.zhihu.com/question/1', 'security_check'],
  ['安全验证页（弹窗文案）', doc('<div role="dialog"><p>系统检测到您的网络环境存在异常，为保证您的正常访问，请输入验证码</p></div>'), 'https://zhuanlan.zhihu.com/p/1', 'security_check'],
  ['登录墙（弹窗）', doc('<div class="Modal"><div class="SignFlow">手机号登录</div></div>'), 'https://www.zhihu.com/question/1', 'login_required'],
  ['登录墙（遮罩文案）', doc('<div class="Modal-wrapper"><div>登录后查看更多优质内容</div></div>'), 'https://www.zhihu.com/hot', 'login_required'],
  ['登录页 URL', doc('<div></div>'), 'https://www.zhihu.com/signin?next=%2Fhot', 'login_required'],
  ['骨架页未加载完', doc('<div id="root"><div class="Skeleton"></div></div>'), 'https://www.zhihu.com/question/1/answer/2', 'not_loaded'],
  ['正文提到安全验证/登录（不是错误页）', doc('<div class="Post-RichText"><p>系统检测到您的网络异常时会弹出安全验证；登录后查看更多。</p></div>'), 'https://zhuanlan.zhihu.com/p/1', 'not_loaded'],
  ['空白页', doc(''), '', 'not_loaded'],
  ['40362 限流 JSON（Chrome 用 <pre> 显示）', doc('<pre>{"error":{"code":40362,"message":"您当前请求存在异常，暂时限制本次访问。如有疑问，您可以通过手机摇一摇或登录后私信知乎小管家反馈。8131ad5f"}}</pre>'), 'https://zhuanlan.zhihu.com/p/19763358', 'security_check'],
  ['40362 限流 JSON（裸文本，无正文容器）', doc('{"error":{"code":40362,"message":"x"}}'), 'https://www.zhihu.com/question/19550225', 'security_check'],
  ['限流文案（无 code，页面很短）', doc('<div id="root"><p>您当前请求存在异常，暂时限制本次访问</p></div>'), 'https://www.zhihu.com/question/1', 'security_check'],
  ['正常长文里提到 40362 不算限流', doc(`<div class="Post-RichText"><p>错误码 40362 表示请求存在异常。${'正文'.repeat(1200)}</p></div>`, '知乎错误码 40362 解析 - 知乎'), 'https://zhuanlan.zhihu.com/p/2', 'not_loaded'],
  ['其它 JSON 错误码不算限流', doc('<pre>{"error":{"code":10003,"message":"not found"}}</pre>'), 'https://www.zhihu.com/question/1', 'not_loaded'],
  ['标题含“安全验证”的普通文章不误判', doc('<div id="root"></div>', '如何应对安全验证 - 知乎'), 'https://zhuanlan.zhihu.com/p/3', 'not_loaded'],
  ['短回答正文含 40362 不算限流（round2 审查必须改 1）', doc('<div class="RichContent"><p>今天遇到错误码 40362，过一会就好了。</p></div>'), 'https://www.zhihu.com/question/1/answer/2', 'not_loaded'],
  ['短文含“暂时限制本次访问”不算限流', doc('<div class="Post-RichText"><p>知乎提示“暂时限制本次访问”怎么办？</p></div>'), 'https://zhuanlan.zhihu.com/p/5', 'not_loaded'],
  ['标题以“安全验证”开头才算', doc('<div id="root"></div>', '安全验证'), 'https://www.zhihu.com/question/1', 'security_check'],
];

for (const [name, d, url, code] of cases) {
  const r = diagnoseFailure(d, url);
  assert.equal(r.code, code, name);
  assert.equal(r.message, FAILURE_MESSAGES[code], name);
}

// 文案要求：三种提示都能看出原因
assert.match(FAILURE_MESSAGES.not_loaded, /页面未加载完/);
assert.match(FAILURE_MESSAGES.login_required, /需要登录/);
assert.match(FAILURE_MESSAGES.security_check, /被知乎限流或需要验证/);
assert.doesNotMatch(FAILURE_MESSAGES.security_check, /未加载完/);

const res = failureResult(doc('<div class="signFlowModal"></div>'), 'https://www.zhihu.com/question/1');
assert.deepEqual(res, { success: false, reason: 'login_required', error: FAILURE_MESSAGES.login_required });

console.log(`failure-reason tests passed (${cases.length} cases)`);
