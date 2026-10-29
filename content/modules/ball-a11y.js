/**
 * Z2：悬浮球的读屏状态。aria-label 随状态更新，导出中设 aria-busy。
 */
import { t } from './i18n.js';

/** 空闲态读屏名称，按界面语言（_locales）取 */
export const idleAriaLabel = () => t('ballAriaIdle');

const trimEnd = (text) => String(text || '').replace(/[!！。.…\s]+$/u, '');

export function ballA11y(state, message = '') {
  message = trimEnd(message);
  switch (state) {
    case 'loading':
      return { label: t('ballAriaLoading', message || t('ballAriaWait')), busy: true };
    case 'success':
      return { label: t('ballAriaDone', message || t('ballAriaSuccess')), busy: false };
    case 'warning': // 设计 M1：部分导出是警告，读屏不说「失败」
      return { label: t('ballAriaDone', message), busy: false };
    case 'error':
      return { label: t('ballAriaError', message || t('ballAriaErrorDefault')), busy: false };
    default:
      return { label: idleAriaLabel(), busy: false };
  }
}

export function applyBallA11y(ball, state, message) {
  const { label, busy } = ballA11y(state, message);
  ball.setAttribute('aria-label', label);
  if (busy) ball.setAttribute('aria-busy', 'true');
  else ball.removeAttribute('aria-busy');
}
