/**
 * Popup v2（Round 3 C-2 / Z3-3）
 * 结构：顶栏 → 当前页卡片（状态徽标、标题、类型 · 作者、进度）→ 内联 alert → 主按钮整行 + 次按钮 → 最近导出 3 条 → 底栏（快捷键、版本）
 */

import { createLogger } from '../lib/logger.js';
import { checkUrlType } from '../lib/page-detector.js';
import { copyTextLater } from '../lib/clipboard.js';
import { describeFailure, ExportFailure } from '../lib/failure-text.js';
import { shortcutGuide } from '../lib/shortcut-guide.js';
import { RECENT_KEY, recordRecent, relativeTime } from '../lib/recent-exports.js';
import { partialHint, partialText } from '../lib/partial-export.js';
import { IMAGE_KEPT_REASON, IMAGE_KEPT_REASON_SEP, imageFailText, imageFailedKeptText, imageKeptMoreShortText, imageKeptMoreText, imageKeptText, imagePartialLine } from '../lib/image-pack.js';
import { svgIcon } from '../lib/safe-dom.js';
import { splitFilename } from '../lib/filename-split.js';

const Logger = createLogger('[Zhihu-MD Popup]');

const $ = (id) => document.getElementById(id);
const statusBadge = $('page-status');
const statusText = statusBadge.querySelector('.status-text');
const articleInfo = $('article-info');
const articleTitle = $('article-title');
const articleType = $('article-type');
const articleAuthor = $('article-author');
const authorWrap = $('article-author-wrap');
const errorMessage = $('error-message');
const actionFeedback = $('action-feedback');
const actionOk = $('action-ok');
const actionInfo = $('action-info');
const progress = $('progress');
const refreshBtn = $('refresh-btn');
const openBtn = $('open-btn');
const feedbackOpen = $('feedback-open'); // 设计复核 935b5b5：部分导出时「打开」放在琥珀提示里
const exportBtn = $('export-btn');
const copyBtn = $('copy-btn');
const settingsBtn = $('settings-btn');
const exportLabel = exportBtn.querySelector('.label');
const copyLabel = copyBtn.querySelector('.label');

const PRIMARY = '导出 Markdown';
const COPY = '复制 Markdown';
const TYPE_LABEL = {
  column: ['知乎专栏', '专栏文章'], answer: ['知乎回答', '回答'], question: ['知乎问题', '问题'],
  home: ['知乎首页', '首页推荐'], follow: ['知乎关注', '关注动态'], hot: ['知乎热榜', '热榜'],
};
let pageBadge = '知乎页面';
let lastDownloadId = null;
let retryMode = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function safeSendMessage(tabId, message, maxRetries = 2, delay = 500) {
  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      if (i > 0) await sleep(delay);
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      lastError = error;
      if (error.message && error.message.includes('Could not establish connection')) continue;
      throw error;
    }
  }
  throw lastError;
}

/** 徽标：idle（页面类型）/ run / ok / err */
function updateStatus(type, text) {
  statusBadge.className = `badge ${type}`;
  setStatusText(statusText, text); // 设计验收建议：徽标也走 .nw，词组不拆
}

function hideAlerts() {
  for (const el of [actionFeedback, actionOk, actionInfo]) el.classList.add('hidden');
  setImageLine('ok-kept', '');
  $('info-kept').textContent = '';
  $('info-kept').classList.add('hidden');
  $('info-text').removeAttribute('title');
  setImageLine('feedback-img', '');
}

/** 第三轮设计：「已保存」文件名单行，中间省略保住后缀；DOM 文字和 title 都是全名 */
function setSavedFilename(name) {
  const el = $('ok-file');
  const full = String(name || '');
  const [stem, suffix] = splitFilename(full);
  const a = document.createElement('span');
  a.className = 'fn-stem';
  a.textContent = stem;
  const b = document.createElement('span');
  b.className = 'fn-suffix';
  b.textContent = suffix;
  el.replaceChildren(a, b);
  el.title = full;
}

/**
 * 设计 R05 / R09：中文状态文案里不能从中间断开的词组和“数字+量词”。
 * 320 宽时「条未能加/载」被拆到两行；这些片段包进 .nw（white-space:nowrap），textContent 不变。
 */
const NOWRAP_RE = /文件已保存|已保存|可稍后|不支持保存|均已保留|第 \d+ 页|\d+(?:\/\d+)? (?:张图片|条|张)|未能加载|未能下载|加载失败|未加载完|在线链接|重新导出|刷新页面|知乎页面|几分钟后|剪贴板|登录|验证|限流/g;
function noWrapNodes(text) {
  const out = [];
  const s = String(text ?? '');
  let last = 0;
  for (const m of s.matchAll(NOWRAP_RE)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const span = document.createElement('span');
    span.className = 'nw';
    span.textContent = m[0];
    out.push(span);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function setStatusText(el, text) {
  el.replaceChildren(...noWrapNodes(text));
}

/** 第三轮 B：次级说明行；kept 时 title 和读屏文字补上原因 */
function setImageLine(id, text, withReason = false) {
  const el = $(id);
  if (!el) return;
  el.replaceChildren();
  el.classList.toggle('hidden', !text);
  el.removeAttribute('title');
  if (!text) return;
  el.append(...noWrapNodes(text));
  if (withReason) {
    el.title = `${text}：${IMAGE_KEPT_REASON}`;
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = `${IMAGE_KEPT_REASON_SEP}${IMAGE_KEPT_REASON}`;
    el.append(sr);
  }
}

function showArticleInfo(info) {
  const [badge, label] = TYPE_LABEL[info.type] || ['知乎页面', '页面'];
  pageBadge = badge;
  updateStatus('idle', badge);
  articleTitle.textContent = info.title || '（无标题）';
  articleTitle.setAttribute('title', articleTitle.textContent); // 单行省略：title 写完整标题
  articleType.textContent = label;
  articleAuthor.textContent = info.author || '未知作者';
  authorWrap.classList.toggle('hidden', !info.author);
  articleInfo.classList.remove('hidden');
  errorMessage.classList.add('hidden');
  setExportActionsEnabled(true);
}

/** 非知乎页、不支持的知乎页：空状态卡，按钮置灰 */
function showUnsupported(desc) {
  articleInfo.classList.add('hidden');
  errorMessage.querySelector('.empty-desc').textContent = desc || '打开知乎问题、回答或专栏文章后可用';
  errorMessage.classList.remove('hidden');
  updateStatus('idle', '不支持此页面');
  setExportActionsEnabled(false, '当前页面不支持导出，所以按钮不可用');
}

/** 内容脚本还没就绪：info alert，按钮置灰，可刷新 */
function showNotReady(tab, text, showRefresh) {
  articleTitle.textContent = (tab && tab.title) || '知乎页面';
  articleTitle.setAttribute('title', articleTitle.textContent); // 单行省略：title 写完整标题
  updateStatus('idle', '不可用');
  setStatusText($('info-text'), text);
  refreshBtn.classList.toggle('hidden', !showRefresh);
  actionInfo.classList.remove('hidden');
  setRecentRows(2);
  // 设计复验 S2：原因已在下方状态区提示框里显示（#info-text），按钮的描述不再重复同一句
  setExportActionsEnabled(false, '暂不可导出，原因见下方提示');
}

/** popup 里主按钮就是「重试」，下一步写短一点（与样稿一致） */
const POPUP_HINT = { security_check: '在知乎页面完成验证后点“重试”' };

/** Z3-3：失败用内联 alert（原因 + 下一步），主按钮变成「重试」 */
function setFeedbackTone(tone) {
  // 设计 M1：部分导出是警告（琥珀色、三角、status/polite），其余失败是错误（红色、叹号、alert）
  const warn = tone === 'warn';
  if (!warn && feedbackOpen) feedbackOpen.classList.add('hidden');
  actionFeedback.className = `alert ${warn ? 'warn' : 'err'}${actionFeedback.classList.contains('hidden') ? ' hidden' : ''}`;
  actionFeedback.setAttribute('role', warn ? 'status' : 'alert');
  const icon = svgIcon(warn ? 'warn' : 'alert');
  icon.id = 'feedback-icon';
  $('feedback-icon').replaceWith(icon);
}

function showActionFeedback(feedback) {
  setFeedbackTone('err');
  if (!feedback) {
    actionFeedback.classList.add('hidden');
    delete actionFeedback.dataset.reason;
    $('feedback-title').textContent = '';
    $('feedback-hint').textContent = '';
    setRecentRows(3);
    return;
  }
  const [title, ...rest] = feedback.text.split(/[：:]/);
  setStatusText($('feedback-title'), rest.length ? title : feedback.text);
  setStatusText($('feedback-hint'), POPUP_HINT[feedback.reason] || rest.join('：'));
  actionFeedback.dataset.reason = feedback.reason;
  actionFeedback.classList.remove('hidden');
  setRecentRows(2);
}

function setExportActionsEnabled(enabled, reason = '') {
  exportBtn.disabled = !enabled;
  copyBtn.disabled = !enabled;
  const hint = $('action-hint');
  hint.textContent = enabled ? '' : reason;
}

function setRunning(running, text = '正在导出…') {
  exportBtn.querySelector('.btn-icon').classList.toggle('hidden', running);
  exportBtn.querySelector('.spinner').classList.toggle('hidden', !running);
  if (running) {
    exportBtn.setAttribute('aria-busy', 'true');
    exportLabel.textContent = '正在导出…';
    updateStatus('run', '正在导出');
    $('progress-text').textContent = text;
    // 设计 R05：进度那行文字隐藏，读屏从 progressbar 的 aria-valuetext 拿到同一句
    progress.querySelector('[role=progressbar]').setAttribute('aria-valuetext', text);
    progress.classList.remove('hidden');
    setExportActionsEnabled(false, '正在导出，请稍候');
  } else {
    exportBtn.removeAttribute('aria-busy');
    progress.querySelector('[role=progressbar]').removeAttribute('aria-valuetext');
    progress.classList.add('hidden');
  }
}

function setRetry(on) {
  retryMode = on;
  exportLabel.textContent = on ? '重试' : PRIMARY;
}

/** 发版审计 N4：出错或未就绪时提示框更高，最近导出收到 2 行，320/360 宽不出内滚动 */
let recentRows = 3;
function setRecentRows(n) {
  if (recentRows === n) return;
  recentRows = n;
  renderRecent().catch(() => {});
}

async function renderRecent() {
  if (!chrome.storage || !chrome.storage.local) return;
  const got = await chrome.storage.local.get({ [RECENT_KEY]: [] });
  const items = (got[RECENT_KEY] || []).slice(0, recentRows);
  const box = $('recent');
  const list = $('recent-list');
  list.textContent = '';
  if (!items.length) { box.classList.add('hidden'); return; }
  const now = Date.now();
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'row';
    const b = document.createElement('span');
    b.className = `badge ${it.ok ? 'ok' : 'err'}`;
    b.setAttribute('aria-label', it.ok ? '成功' : '失败');
    b.setAttribute('role', 'img');
    b.append(svgIcon(it.ok ? 'check' : 'alert'));
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = it.title;
    n.title = it.title;
    const t = document.createElement('small');
    t.textContent = relativeTime(it.ts, now);
    row.append(b, n, t);
    list.append(row);
  }
  box.classList.remove('hidden');
}

// Z3-03：快捷键没注册上（被其他扩展/浏览器占用）时给出「去设置」引导
function renderShortcut(cmds) {
  const g = shortcutGuide(cmds, 'export-page', navigator.userAgent);
  const kbd = $('shortcut-kbd');
  const box = $('shortcut-guide');
  if (g.set) {
    kbd.textContent = g.shortcut;
    kbd.classList.remove('hidden');
    $('shortcut-prefix').classList.remove('hidden');
    box.classList.add('hidden');
    box.replaceChildren();
    return;
  }
  kbd.classList.add('hidden');
  $('shortcut-prefix').classList.add('hidden'); // 「快捷键未设置」已含前缀，省出 320px 宽度
  const label = document.createElement('span');
  label.className = 'sc-label';
  label.textContent = g.label;
  const sep = document.createElement('span');
  sep.className = 'sc-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '·';
  box.replaceChildren(label, sep);
  if (g.url) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'shortcut-setup';
    btn.className = 'sc-link';
    btn.textContent = g.button;
    btn.addEventListener('click', () => {
      // chrome:// / edge:// 页面只能用 tabs.create 打开，且不需要 tabs 权限
      chrome.tabs.create({ url: g.url }).catch(() => {});
    });
    box.append(btn);
  } else {
    const hint = document.createElement('span');
    hint.className = 'sc-hint';
    hint.textContent = g.hint;
    box.append(hint);
  }
  box.classList.remove('hidden');
}

function renderFooter() {
  try {
    const v = chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '';
    $('footer-version').textContent = v ? `v${v}` : '';
  } catch { /* 测试环境 */ }
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll().then((cmds) => {
      renderShortcut(cmds);
    }).catch(() => {});
  }
}

async function init() {
  renderFooter();
  renderRecent().catch(() => {});
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) { showUnsupported('无法访问当前页面'); return; }
    const f = checkUrlType(tab.url);
    if (!f || !f.isZhihu) { showUnsupported(); return; }
    let type = null;
    if (f.isColumn) type = 'column';
    else if (f.isAnswer) type = 'answer';
    else if (f.isQuestion) type = 'question';
    else if (f.isHome) type = 'home';
    else if (f.isFollow) type = 'follow';
    else if (f.isHot) type = 'hot';
    if (!type) { showUnsupported('请打开知乎文章、问题、回答、首页、关注或热榜页面'); return; }

    try {
      const response = await safeSendMessage(tab.id, { action: 'getArticleInfo' });
      if (response && response.success) {
        showArticleInfo({ title: response.data.title, author: response.data.author, type });
      } else {
        throw new ExportFailure(response);
      }
    } catch (msgError) {
      Logger.warn('getArticleInfo failed:', msgError);
      const fb = describeFailure(msgError, 'export');
      if (fb.reason === 'not_loaded') showNotReady(tab, '页面仍在加载，正文就绪后可导出', true);
      else showNotReady(tab, fb.text, true);
    }
  } catch (error) {
    Logger.error('Init Error:', error);
    showUnsupported('未知错误');
  }
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ downloadImages: false, maxAnswerCount: 20 }, resolve);
  });
}

async function handleExport() {
  hideAlerts();
  showActionFeedback(null);
  setRetry(false);
  const settings = await getSettings();
  setRunning(true, settings.downloadImages ? '正在导出并打包图片…' : '正在导出…');
  const title = articleTitle.textContent;
  let sentToBackground = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await safeSendMessage(tab.id, { action: 'exportMarkdown', downloadImages: settings.downloadImages });
    if (!response || !response.success) throw new ExportFailure(response);
    const msg = { action: 'download', filename: response.data.filename, content: response.data.content, title };
    if (response.data.images && response.data.images.length > 0) {
      msg.images = response.data.images;
      msg.downloadImages = true;
    }
    sentToBackground = true; // 之后的失败由 background 记录
    const res = await chrome.runtime.sendMessage(msg);
    if (res && res.success === false) throw new Error(res.error || '下载失败');
    lastDownloadId = res && res.downloadId != null ? res.downloadId : null;
    setRunning(false);
    if (response.data.partial) {
      // 发版 QA ZR-02 / 设计 M1：文件已保存但不完整 → 警告样式「部分导出」，同时给出「打开」
      updateStatus('warn', '部分导出');
      showActionFeedback({ text: partialText(response.data.partial), reason: 'partial' });
      setFeedbackTone('warn');
      setStatusText($('feedback-title'), partialText(response.data.partial));
      setStatusText($('feedback-hint'), partialHint(response.data.partial));
      // 设计复核 935b5b5：不再显示绿色「已保存」框，「打开」挪进琥珀提示
      feedbackOpen.classList.toggle('hidden', lastDownloadId == null);
      {
        const f = (res && res.failedImages) || 0;
        const k = (res && res.keptImages) || 0;
        if (f > 0 && k > 0) {
          // PM 定稿 2026-10-29：整句上屏（{f} 张图片未能下载，{k} 张不支持保存，均已保留在线链接），不再用 .sr-only 和 title
          setImageLine('feedback-img', imageFailedKeptText(f, k));
        } else {
          setImageLine('feedback-img', imagePartialLine(f, k), f === 0 && k > 0);
        }
        // 设计复核 32569cb：部分导出一律缩为 1 行（不再按 f/k 分情况，也不按宽度切换），320 宽不出内滚动
        setRecentRows(1);
      }
      exportLabel.textContent = PRIMARY;
      setExportActionsEnabled(true);
      renderRecent().catch(() => {});
      return;
    }
    updateStatus('ok', '已完成');
    setSavedFilename((res && res.filename) || response.data.filename);
    openBtn.classList.toggle('hidden', lastDownloadId == null);
    actionOk.classList.remove('hidden');
    const keptImages = (res && res.keptImages) || 0;
    if (!(res && res.failedImages > 0) && keptImages > 0) {
      // 第三轮 B：只有按规则保留的图片 → 仍是成功，「已保存」下加一行次级说明
      setImageLine('ok-kept', imageKeptText(keptImages), true);
      setRecentRows(2); // 设计复核 4193502 F1：多一行次级说明时最近导出同样缩为 2 行
    }
    if (res && res.failedImages > 0) {
      // 发版 QA ZR-09：部分图片没打进 zip，正文里已保留在线链接（N 只算真正的失败）
      // PM 定稿 2026-10-29：两者都有时整句上屏，去掉 .sr-only 补充和 title
      setStatusText($('info-text'), keptImages > 0 ? imageFailedKeptText(res.failedImages, keptImages) : imageFailText(res.failedImages));
      $('info-kept').textContent = '';
      $('info-kept').classList.add('hidden');
      $('info-text').removeAttribute('title');
      $('refresh-btn').classList.add('hidden');
      actionInfo.classList.remove('hidden');
      setRecentRows(2); // 设计建议 1：多一条提示时最近导出缩为 2 行，320 宽不出内滚动
    }
    exportLabel.textContent = PRIMARY;
    setExportActionsEnabled(true);
  } catch (error) {
    Logger.error('Export Error:', error);
    setRunning(false);
    updateStatus('err', '失败');
    const fb = describeFailure(error, 'export');
    showActionFeedback(fb);
    setRetry(true);
    setExportActionsEnabled(true);
    if (!sentToBackground) recordRecent(chrome.storage, { title, ok: false }).then(renderRecent).catch(() => {});
  }
  renderRecent().catch(() => {});
}

function handleCopy() {
  hideAlerts();
  showActionFeedback(null);
  setExportActionsEnabled(false, '正在复制');
  copyLabel.textContent = '复制中…';
  const pending = copyTextLater(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await safeSendMessage(tab.id, { action: 'exportMarkdown', downloadImages: false });
    if (!response || !response.success) throw new ExportFailure(response);
    return response.data.content;
  });
  pending.then(() => {
    copyLabel.textContent = '已复制';
    updateStatus('ok', '已复制');
  }).catch((error) => {
    Logger.error('Copy Error:', error);
    copyLabel.textContent = COPY;
    updateStatus('err', '失败');
    showActionFeedback(describeFailure(error, 'copy'));
  }).finally(() => {
    setExportActionsEnabled(true);
    setTimeout(() => {
      copyLabel.textContent = COPY;
      if (statusBadge.classList.contains('ok')) updateStatus('idle', pageBadge);
    }, 1600);
  });
}

settingsBtn.addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open(chrome.runtime.getURL('options/options.html'));
});
exportBtn.addEventListener('click', handleExport);
copyBtn.addEventListener('click', handleCopy);
function openLastDownload() {
  if (lastDownloadId != null && chrome.downloads && chrome.downloads.show) chrome.downloads.show(lastDownloadId);
}
openBtn.addEventListener('click', openLastDownload);
feedbackOpen.addEventListener('click', openLastDownload);
refreshBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) { chrome.tabs.reload(tab.id); window.close(); }
});

export const __test = { get retryMode() { return retryMode; } };
init();
