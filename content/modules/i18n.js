/**
 * 注入页面向用户的文字：走 chrome.i18n（_locales），取不到时回退到中文（与 zh_CN/messages.json 一致，测试会比对）。
 */
export const ZH_FALLBACK = {
  ballTooltipIdle: "点击下载 · 右键复制",
  ballTooltipIdlePart1: "点击下载 ·",
  ballTooltipIdlePart2: "右键复制",
  ballAriaIdle: "导出 Markdown（点击下载，右键复制）",
  ballLoadingContent: "正在加载内容…",
  ballExportingHot: "正在导出热榜…",
  ballDownloadingImages: "正在下载图片…",
  ballExporting: "正在导出…",
  ballCopying: "正在复制…",
  ballExported: "已导出",
  ballExportedImagesFailed: "已导出，$1 张图片未能下载，已保留在线链接",
  ballExportedImagesFailedOne: "已导出，$1 张图片未能下载，已保留在线链接",
  ballCopied: "已复制",
  ballCopiedSelection: "已复制选中内容",
  ballNoSelection: "没有选中内容，先选中一段文字再复制",
  ballPartial: "部分导出：已导出 $1/$2 条，$3 条未能加载",
  ballImagesFailed: "$1 张图片未能下载，已保留在线链接",
  ballImagesFailedOne: "$1 张图片未能下载，已保留在线链接",
  ballImagesKept: "$1 张图片保留为在线链接",
  ballImagesKeptOne: "$1 张图片保留为在线链接",
  ballImagesKeptMore: "另有 $1 张保留为在线链接",
  ballImagesKeptMoreOne: "另有 $1 张保留为在线链接",
  ballImagesKeptReason: "这些图片的格式或来源不支持保存到本地",
  ballSep: "，",
  ballPartialSep: "；",
  ballAriaLoading: "正在导出：$1",
  ballAriaWait: "请稍候",
  ballAriaDone: "$1。再次点击可重新导出",
  ballAriaSuccess: "导出成功",
  ballAriaError: "导出失败：$1。按回车重试",
  ballAriaErrorDefault: "请刷新页面后重试",
  failSecurityCheck: "被知乎限流或需要验证：请在知乎页面完成验证，或稍等几分钟后刷新再导出",
  failLoginRequired: "需要登录知乎才能查看这部分内容，请登录后重新导出",
  failNotLoaded: "页面未加载完，请等几秒或刷新页面后再试",
  failClipboard: "无法写入剪贴板：请保持弹窗打开后重试，或改用“导出 Markdown”",
  failExportUnknown: "导出失败，请刷新知乎页面后重试",
  failCopyUnknown: "复制失败，请刷新知乎页面后重试",
};

const fill = (text, subs) => String(text).replace(/\$(\d)/g, (_, i) => String(subs[i - 1] ?? ''));

/** @param {string} key  @param {...(string|number)} subs  $1..$n 替换值 */
export function t(key, ...subs) {
  let msg = '';
  try { msg = globalThis.chrome?.i18n?.getMessage?.(key, subs.map(String)) || ''; } catch { msg = ''; }
  return msg || fill(ZH_FALLBACK[key] ?? key, subs);
}

/** 带数量的条目：数量为 1 且有 `${key}One` 时用单数（英文 1 image / N images；中文两条相同） */
export function tn(key, n, ...rest) {
  return Number(n) === 1 && Object.hasOwn(ZH_FALLBACK, `${key}One`) ? t(`${key}One`, n, ...rest) : t(key, n, ...rest);
}
