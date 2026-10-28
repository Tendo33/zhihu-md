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
];

for (const [name, d, url, code] of cases) {
  const r = diagnoseFailure(d, url);
  assert.equal(r.code, code, name);
  assert.equal(r.message, FAILURE_MESSAGES[code], name);
}

// 文案要求：三种提示都能看出原因
assert.match(FAILURE_MESSAGES.not_loaded, /页面未加载完/);
assert.match(FAILURE_MESSAGES.login_required, /需要登录/);
assert.match(FAILURE_MESSAGES.security_check, /安全验证/);

const res = failureResult(doc('<div class="signFlowModal"></div>'), 'https://www.zhihu.com/question/1');
assert.deepEqual(res, { success: false, reason: 'login_required', error: FAILURE_MESSAGES.login_required });

console.log(`failure-reason tests passed (${cases.length} cases)`);
