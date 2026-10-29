/** 发版 QA ZR-02 / 设计 M1：批量导出部分成功（警告，不是错误）的统一文案；悬浮球和文件末尾前面加 PARTIAL_PREFIX */
export const PARTIAL_PREFIX = '部分导出：';
export function partialText({ exported, total }) {
  return `已导出 ${exported}/${total} 条，${total - exported} 条未能加载`;
}

export function partialHint({ failedPage }) {
  return `第 ${failedPage} 页起加载失败，文件已保存，可稍后重新导出`;
}
