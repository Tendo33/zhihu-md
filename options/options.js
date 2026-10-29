import { createLogger } from '../lib/logger.js';
import { capAnswerCount, MAX_ANSWER_LIMIT } from '../lib/answer-limit.js';

const Logger = createLogger('[Zhihu-MD Options]');

/** 设计 M7：开关用 role="switch"，aria-checked 与 checked 保持同步 */
export function syncSwitchState(input) {
  if (input) input.setAttribute('aria-checked', input.checked ? 'true' : 'false');
}

function saveOptions() {
  syncSwitchState(document.getElementById('showFloatingBall'));
  syncSwitchState(document.getElementById('downloadImages'));
  const showFloatingBall = document.getElementById('showFloatingBall').checked;
  const maxAnswerCount = parseInt(document.getElementById('maxAnswerCount').value, 10);
  const downloadImages = document.getElementById('downloadImages').checked;

  const validCount = capAnswerCount(Math.max(0, isNaN(maxAnswerCount) ? 20 : maxAnswerCount));
  const capped = maxAnswerCount > MAX_ANSWER_LIMIT;
  document.getElementById('maxAnswerCount').value = validCount;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall,
    maxAnswerCount: validCount,
    downloadImages: downloadImages
  }, () => {
    Logger.info('设置已保存:', { showFloatingBall, maxAnswerCount: validCount, downloadImages });
    // 设计 M3：页脚左侧「✓ 已保存」，2.5 秒后淡出；被上限改值时在数字框下方留一行警示，保留到下次修改
    const note = document.getElementById('note-maxAnswerCount');
    if (note) note.textContent = capped ? `超过上限，已保存为 ${MAX_ANSWER_LIMIT}` : '';
    const status = document.getElementById('status');
    status.textContent = '✓ 已保存';
    status.classList.add('show');
    clearTimeout(saveOptions.hideTimer);
    saveOptions.hideTimer = setTimeout(() => {
      status.classList.remove('show');
    }, 2500);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    showFloatingBall: true,
    maxAnswerCount: 20,
    downloadImages: false
  }, (items) => {
    Logger.info('已读取设置:', items);
    document.getElementById('showFloatingBall').checked = items.showFloatingBall;
    document.getElementById('maxAnswerCount').value = capAnswerCount(items.maxAnswerCount);
    document.getElementById('downloadImages').checked = items.downloadImages;
    syncSwitchState(document.getElementById('showFloatingBall'));
    syncSwitchState(document.getElementById('downloadImages'));
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('showFloatingBall').addEventListener('change', saveOptions);
document.getElementById('maxAnswerCount').addEventListener('change', saveOptions);
document.getElementById('downloadImages').addEventListener('change', saveOptions);


// Z11：版本号从 manifest 读取，不再写死
try {
  const versionEl = document.getElementById('app-version');
  if (versionEl && typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  }
} catch { /* 非扩展环境忽略 */ }
