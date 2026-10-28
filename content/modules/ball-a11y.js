/**
 * Z2：悬浮球的读屏状态。aria-label 随状态更新，导出中设 aria-busy。
 */
export const IDLE_LABEL = '导出 Markdown（点击下载，右键复制）';

export function ballA11y(state, message = '') {
  switch (state) {
    case 'loading':
      return { label: `正在导出：${message || '请稍候'}`, busy: true };
    case 'success':
      return { label: `${message || '导出成功'}。再次点击可重新导出`, busy: false };
    case 'error':
      return { label: `导出失败：${message || '请刷新页面后重试'}。按回车重试`, busy: false };
    default:
      return { label: IDLE_LABEL, busy: false };
  }
}

export function applyBallA11y(ball, state, message) {
  const { label, busy } = ballA11y(state, message);
  ball.setAttribute('aria-label', label);
  if (busy) ball.setAttribute('aria-busy', 'true');
  else ball.removeAttribute('aria-busy');
}
