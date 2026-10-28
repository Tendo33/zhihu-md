/**
 * Z1-01：popup 导出/复制失败时给出具体原因，而不是只写“导出失败”“复制失败”。
 * 复用 failure-reason.js 的三条提示（security_check 已包含 40362 限流文案）。
 */
import { FAILURE_MESSAGES } from './failure-reason.js';

const KNOWN = new Set(Object.values(FAILURE_MESSAGES));
const NO_RECEIVER = /Could not establish connection|Receiving end does not exist|message port closed/i;

export class ExportFailure extends Error {
  constructor(response) {
    super(response?.error || '');
    this.reason = response?.reason || null;
  }
}

/** @returns {{ reason: string, text: string }} */
export function describeFailure(error, action = 'export') {
  const reason = error && error.reason;
  if (reason && FAILURE_MESSAGES[reason]) return { reason, text: FAILURE_MESSAGES[reason] };
  const message = (error && error.message) || '';
  if (KNOWN.has(message)) {
    const code = Object.keys(FAILURE_MESSAGES).find((k) => FAILURE_MESSAGES[k] === message);
    return { reason: code, text: message };
  }
  // 内容脚本还没注入或页面刚刷新：和“页面未加载完”的处理方式一致
  if (NO_RECEIVER.test(message)) return { reason: 'not_loaded', text: FAILURE_MESSAGES.not_loaded };
  if (action === 'copy' && /clipboard|NotAllowedError|Document is not focused/i.test(message)) {
    return { reason: 'clipboard', text: '无法写入剪贴板：请保持弹窗打开后重试，或改用“导出 Markdown”' };
  }
  return { reason: 'unknown', text: `${action === 'copy' ? '复制' : '导出'}失败，请刷新知乎页面后重试` };
}
