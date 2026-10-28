/**
 * 导出失败时判断原因，给出可操作的中文提示。
 * 知乎在正常 URL 上也会返回登录墙、安全验证页或尚未渲染完的骨架页。
 */

export const FAILURE_MESSAGES = {
  security_check: '触发了知乎的安全验证，请先在页面上完成验证，再重新导出',
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
    || SECURITY_TEXT.test(title) || SECURITY_TEXT.test(text)) {
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
