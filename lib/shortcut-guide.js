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
export function shortcutGuide(cmds, commandName, ua = '', lang = 'zh') {
  const c = (cmds || []).find((x) => x && x.name === commandName);
  if (c && c.shortcut) return { set: true, shortcut: c.shortcut };
  const zh = /^zh/i.test(lang || 'zh');
  const browser = detectBrowser(ua);
  const url = shortcutsPageUrl(browser);
  return {
    set: false,
    label: zh ? '快捷键未设置' : 'Shortcut not set',
    url,
    button: url ? (zh ? '去设置' : 'Set up') : null,
    hint: url ? null : (zh ? '在附加组件管理里设置' : 'Set it in Add-ons Manager'),
  };
}
