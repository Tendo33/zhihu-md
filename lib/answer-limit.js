/**
 * 「最大下载条数」上限 1000（Simon 定）。
 * 只加上限：0（尽量全部）、负数、非数字、小数的处理仍由各调用处的原有逻辑决定。
 */
export const MAX_ANSWER_LIMIT = 1000;

export function capAnswerCount(value) {
  return Number(value) > MAX_ANSWER_LIMIT ? MAX_ANSWER_LIMIT : value;
}

export const MIN_ANSWER_NOTE = '至少 1 条，已保存为 1';

/**
 * 设置页保存时规整「最大下载条数」（审查第 5 条）。
 * 空 / 非数字 → 默认 20；0 保持「尽量全部」；负数和 0~1 之间的小数 → 1 并提示；
 * 其余小数向下取整；超过上限 → 1000 并提示。
 * 说明文案写着「填 0 则尽量全部下载」，所以 0 不改成 1（不删功能），见 dev-log 待决策。
 */
export function normalizeAnswerCount(raw) {
  const s = String(raw ?? '').trim();
  const n = s === '' ? NaN : Number(s);
  if (!Number.isFinite(n)) return { value: 20, note: '' };
  if (n === 0) return { value: 0, note: '' };
  if (n < 1) return { value: 1, note: MIN_ANSWER_NOTE };
  if (n > MAX_ANSWER_LIMIT) return { value: MAX_ANSWER_LIMIT, note: `超过上限，已保存为 ${MAX_ANSWER_LIMIT}` };
  return { value: Math.floor(n), note: '' };
}
