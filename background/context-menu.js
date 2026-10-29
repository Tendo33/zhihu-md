/**
 * Round 3 C-3：右键菜单（contextMenus 权限，Simon 已同意）。
 * 页面类菜单（导出本页 / 复制本页 Markdown / 复制选中内容为 Markdown）只在可导出的知乎页面出现（PAGE_PATTERNS）。
 * 链接菜单「打开并导出这个知乎链接」有意不设 documentUrlPatterns：在任意网站上右键指向知乎问题 / 回答 / 专栏文章的链接
 * 都会出现（只按 targetUrlPatterns = LINK_PATTERNS 过滤链接本身），方便从其他网站直接导出。
 */
// 审查建议 1：页面类菜单只在能导出的页面出现（以 lib/page-detector.js 的 detectPageTypeFromPathname 为准）：
//   column  /p/*                 → zhuanlan.zhihu.com/p/*
//   question / answer /question/* → www.zhihu.com/question/*（含 /answer/）
//   hot /hot、follow /follow      → 也是可导出类型（HotExporter / FeedExporter），保留
//   home /                       → 按管理员要求不再显示（首页、搜索页、用户页都不出现）
export const PAGE_PATTERNS = [
  '*://zhuanlan.zhihu.com/p/*',
  '*://www.zhihu.com/question/*',
  '*://www.zhihu.com/hot',
  '*://www.zhihu.com/hot?*',
  '*://www.zhihu.com/follow',
  '*://www.zhihu.com/follow?*',
];
// 链接菜单只看链接目标：任意网站上指向问题 / 回答 / 专栏文章的链接都会出现（有意保留，见文件头）
export const LINK_PATTERNS = ['*://www.zhihu.com/question/*', '*://zhuanlan.zhihu.com/p/*'];

export const MENU_ITEMS = [
  { id: 'zm-page-export', title: '导出本页为 Markdown', contexts: ['page'], documentUrlPatterns: PAGE_PATTERNS },
  { id: 'zm-page-copy', title: '复制本页 Markdown', contexts: ['page'], documentUrlPatterns: PAGE_PATTERNS },
  { id: 'zm-selection-copy', title: '复制选中内容为 Markdown', contexts: ['selection'], documentUrlPatterns: PAGE_PATTERNS },
  { id: 'zm-link-export', title: '打开并导出这个知乎链接', contexts: ['link'], targetUrlPatterns: LINK_PATTERNS },
];

/** 链接是否指向可导出的知乎页面（文章 / 问题 / 回答） */
export function isExportableLink(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'zhuanlan.zhihu.com') return /^\/p\/\d+/.test(u.pathname);
    if (u.hostname === 'www.zhihu.com') return /^\/question\/\d+/.test(u.pathname);
    return false;
  } catch {
    return false;
  }
}

export function createMenus(menus) {
  menus.removeAll(() => {
    for (const item of MENU_ITEMS) {
      menus.create({ ...item });
    }
  });
}

/**
 * @param {object} info chrome.contextMenus.OnClickData
 * @param {object} tab
 * @param {{ tabs: object, openAndWait: Function }} api
 */
export async function handleMenuClick(info, tab, api) {
  const send = (tabId, msg) => api.tabs.sendMessage(tabId, msg);
  switch (info.menuItemId) {
    case 'zm-page-export':
      return send(tab.id, { action: 'triggerExport' });
    case 'zm-page-copy':
      return send(tab.id, { action: 'contextCopy' });
    case 'zm-selection-copy':
      return send(tab.id, { action: 'copySelection' });
    case 'zm-link-export': {
      if (!isExportableLink(info.linkUrl)) return { success: false, reason: 'unsupported' };
      // 审查建议 3：先挂加载监听再建标签页，避免 complete 早于监听而白等超时
      const created = await api.openAndWait({ url: info.linkUrl, active: true, index: (tab?.index ?? -1) + 1 });
      // 审查建议 2：加载超时不再发导出指令，给用户看得见的失败反馈（工具栏「!」徽标 + 提示文字，无新权限）
      if (created && created.timedOut) {
        if (typeof api.notifyFailure === 'function') await api.notifyFailure(created.id, 'timeout');
        return { success: false, reason: 'timeout' };
      }
      return send(created.id, { action: 'triggerExport' });
    }
    default:
      return undefined;
  }
}

/**
 * 先注册 tabs.onUpdated，再 tabs.create；create 返回时已经 complete 也直接放行。
 * 监听在完成或超时后都会移除。超时 resolve 的对象带 timedOut: true，调用方据此不再发导出指令。
 */
export function openAndWait(tabsApi, createProps, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const completed = new Set();
    let tabId = null;
    let created = null;
    let timer = null;
    const finish = (timedOut = false) => {
      tabsApi.onUpdated.removeListener(listener); clearTimeout(timer);
      resolve(timedOut ? { ...created, timedOut: true } : created);
    };
    const listener = (id, change) => {
      if (change.status !== 'complete') return;
      if (tabId === null) completed.add(id);
      else if (id === tabId) finish();
    };
    tabsApi.onUpdated.addListener(listener);
    Promise.resolve(tabsApi.create(createProps)).then((tab) => {
      created = tab; tabId = tab.id;
      if (tab.status === 'complete' || completed.has(tab.id)) return finish();
      timer = setTimeout(() => finish(true), timeoutMs);
    }, (e) => { tabsApi.onUpdated.removeListener(listener); reject(e); });
  });
}


export const LINK_TIMEOUT_TITLE = '知乎页面加载超时，未导出；请在该页面刷新后重新导出';

/** 链接导出失败的可见反馈：在新标签页的工具栏图标上显示「!」并改提示文字（chrome.action，不需要额外权限） */
export async function showLinkFailure(actionApi, tabId) {
  if (!actionApi || tabId == null) return;
  const safe = async (fn) => { try { await fn(); } catch { /* 标签页已关闭 */ } };
  await safe(() => actionApi.setBadgeBackgroundColor({ tabId, color: '#b42318' }));
  // 发版审计 N5：徽标文字显式白色（白字 on #b42318 6.57:1），不依赖 Chrome 自动取色
  await safe(() => actionApi.setBadgeTextColor?.({ tabId, color: '#ffffff' }));
  await safe(() => actionApi.setBadgeText({ tabId, text: '!' }));
  await safe(() => actionApi.setTitle({ tabId, title: LINK_TIMEOUT_TITLE }));
}
