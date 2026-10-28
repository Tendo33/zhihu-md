// Z3-03：快捷键未注册（commands.getAll 返回空 shortcut）时，在弹窗底栏给出「去设置」引导。
// 纯函数，不依赖 chrome.*；不需要新权限（tabs.create 打开 chrome:// 页面不需要 tabs 权限）。

/** 按 UA 判断浏览器：'edge' | 'firefox' | 'chrome' */
export function detectBrowser(ua = '') {
  if (/\bFirefox\//.test(ua)) return 'firefox';
  if (/\bEdg\//.test(ua)) return 'edge';
  return 'chrome';
}

export function shortcutsPageUrl(browser) {
  if (browser === 'edge') return 'edge://extensions/shortcuts';
  if (browser === 'firefox') return null; // Firefox 不允许扩展打开 about:addons 的快捷键页，只给文字提示
  return 'chrome://extensions/shortcuts';
}

/**
 * @param {Array<{name:string, shortcut?:string}>} cmds commands.getAll() 结果
 * @returns {{ set: true, shortcut: string } | { set: false, label: string, url: string|null, button: string|null, hint: string|null }}
 */
// 弹窗其余文字固定中文，引导也固定中文（设计验收 2026-10-28）；整窗 i18n 后再统一切换。
export function shortcutGuide(cmds, commandName, ua = '') {
  const c = (cmds || []).find((x) => x && x.name === commandName);
  if (c && c.shortcut) return { set: true, shortcut: c.shortcut };
  const browser = detectBrowser(ua);
  const url = shortcutsPageUrl(browser);
  return {
    set: false,
    label: '快捷键未设置',
    url,
    button: url ? '去设置' : null,
    hint: url ? null : '在附加组件管理里设置',
  };
}
