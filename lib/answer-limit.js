/**
 * 「最大下载回答数」上限 1000（Simon 定）。
 * 只加上限：0（尽量全部）、负数、非数字、小数的处理仍由各调用处的原有逻辑决定。
 */
export const MAX_ANSWER_LIMIT = 1000;

export function capAnswerCount(value) {
  return Number(value) > MAX_ANSWER_LIMIT ? MAX_ANSWER_LIMIT : value;
}
