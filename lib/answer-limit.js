/**
 * 「最大下载条数」上限 1000（Simon 定）。
 * capAnswerCount：导出时把旧值或同步来的大数字截到 1000。
 * normalizeAnswerCount：设置页保存时统一规整——0 是「尽量全部（上限 1000）」的哨兵值，
 * 其余小于 1 的值存成 1 并提示，超过上限存成 1000 并提示。
 */
export const MAX_ANSWER_LIMIT = 1000;

export function capAnswerCount(value) {
  return Number(value) > MAX_ANSWER_LIMIT ? MAX_ANSWER_LIMIT : value;
}

export const MIN_ANSWER_NOTE = '需为 0 或正整数，已保存为 1';

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
