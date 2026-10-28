/**
 * 导出失败时判断原因，给出可操作的中文提示。
 * 知乎在正常 URL 上也会返回登录墙、安全验证页或尚未渲染完的骨架页。
 */

export const FAILURE_MESSAGES = {
  security_check: '被知乎限流或需要验证：请在知乎页面完成验证，或稍等几分钟后刷新再导出',
  login_required: '需要登录知乎才能查看这部分内容，请登录后重新导出',
  not_loaded: '页面未加载完，请等几秒或刷新页面后再试',
};

const SECURITY_SELECTORS = [
  '.Unhuman', '#Unhuman', '.Captcha', '#captcha', '.yidun', '.yidun_popup',
  'iframe[src*="captcha"]', '[class*="Unhuman"]',
].join(',');

const LOGIN_SELECTORS = [
  '.signFlowModal', '.Modal .SignFlow', '.SignContainer-content',
  '.SignFlow-tabs', '.Login-content', '.ContentItem-login',
].join(',');

// 只在页面状态（URL、标题）和遮罩/弹窗节点里匹配文案，不看正文：
// 正文里写着“安全验证”“登录后查看”的普通文章不能被误诊。
const SECURITY_TEXT = /安全验证|系统检测到您的(?:网络|帐号|账号)|请完成验证|异常流量|unhuman/i;
// 标题只认验证页自己的标题（“安全验证”开头，如“安全验证 - 知乎”），
// 避免“如何应对安全验证 - 知乎”这类普通文章标题被误判。
const SECURITY_TITLE = /^\s*安全验证\s*(?:[-–—|]\s*知乎(?:专栏)?)?\s*$/;

// 知乎风控（限流）直接返回 JSON：{"error":{"code":40362,"message":"您当前请求存在异常，暂时限制本次访问…"}}
const RATE_LIMIT_TEXT = /40362|请求存在异常|暂时限制本次访问/;
const CONTENT_CONTAINERS = '.Post-RichText, .RichContent, .RichText, .QuestionHeader, .Post-Title, .AnswerItem, .QuestionAnswer-content';
const SHORT_BODY_CHARS = 2000;

function bodyText(doc) {
  return (doc?.body?.textContent || '').trim();
}

function jsonErrorCode(text) {
  if (!text || text[0] !== '{') return null;
  try {
    return JSON.parse(text)?.error?.code ?? null;
  } catch {
    return null;
  }
}

/** 知乎 40362 限流页：没有正文容器、正文很短或只有 <pre>，且内容是风控 JSON/文案 */
export function isRateLimited(doc) {
  if (!doc?.body) return false;
  const hasContent = !!doc.querySelector?.(CONTENT_CONTAINERS);
  const text = bodyText(doc);
  // 有正文容器就是正常内容页（哪怕正文很短、正文里提到 40362），一律不判限流
  if (hasContent) return false;
  if (String(jsonErrorCode(text)) === '40362') return true;
  return RATE_LIMIT_TEXT.test(text.slice(0, SHORT_BODY_CHARS));
}
const LOGIN_TEXT = /登录后(?:查看|阅读|继续)|登录知乎，|登录即可查看|请登录后/;
const OVERLAY_SELECTORS = '.Modal, .Modal-wrapper, [role="dialog"], [aria-modal="true"]';

function overlayText(doc) {
  const nodes = doc?.querySelectorAll?.(OVERLAY_SELECTORS) || [];
  return Array.from(nodes, (n) => n.textContent || '').join('\n').slice(0, 20000);
}

/**
 * @param {Document} doc
 * @param {string} [url]
 * @returns {{ code: 'security_check'|'login_required'|'not_loaded', message: string }}
 */
export function diagnoseFailure(doc, url = '') {
  const href = String(url || '');
  const title = doc?.title || '';
  const text = overlayText(doc);

  if (/\/account\/unhuman|unhuman\?|\/captcha/i.test(href)
    || doc?.querySelector?.(SECURITY_SELECTORS)
    || SECURITY_TITLE.test(title) || SECURITY_TEXT.test(text)
    || isRateLimited(doc)) {
    return { code: 'security_check', message: FAILURE_MESSAGES.security_check };
  }

  if (/\/signin|\/signup|\/login/i.test(href)
    || doc?.querySelector?.(LOGIN_SELECTORS)
    || LOGIN_TEXT.test(text)) {
    return { code: 'login_required', message: FAILURE_MESSAGES.login_required };
  }

  return { code: 'not_loaded', message: FAILURE_MESSAGES.not_loaded };
}

/** 统一的失败结果，带上原因代码，方便界面和测试区分 */
export function failureResult(doc = globalThis.document, url = globalThis.location?.href) {
  const { code, message } = diagnoseFailure(doc, url);
  return { success: false, reason: code, error: message };
}
