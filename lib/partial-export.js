/** 发版 QA ZR-02：批量导出中途失败的统一文案（popup、悬浮球、正文末尾共用） */
export function partialText({ exported, total }) {
  return `已导出 ${exported}/${total} 条，部分失败`;
}

export function partialHint({ failedPage }) {
  return `第 ${failedPage} 页回答加载失败，内容不完整，可稍后重新导出`;
}
