import { createLogger } from '../lib/logger.js';
import { capAnswerCount, MAX_ANSWER_LIMIT } from '../lib/answer-limit.js';

const Logger = createLogger('[Zhihu-MD Options]');

function saveOptions() {
  const showFloatingBall = document.getElementById('showFloatingBall').checked;
  const maxAnswerCount = parseInt(document.getElementById('maxAnswerCount').value, 10);
  const downloadImages = document.getElementById('downloadImages').checked;

  // Validate: 0 means unlimited, otherwise must be >= 1
  const validCount = capAnswerCount(Math.max(0, isNaN(maxAnswerCount) ? 20 : maxAnswerCount));
  const capped = maxAnswerCount > MAX_ANSWER_LIMIT;
  document.getElementById('maxAnswerCount').value = validCount;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall,
    maxAnswerCount: validCount,
    downloadImages: downloadImages
  }, () => {
    Logger.info('设置已保存:', { showFloatingBall, maxAnswerCount: validCount, downloadImages });
    const status = document.getElementById('status');
    status.textContent = capped ? `已按上限保存为 ${MAX_ANSWER_LIMIT}` : '设置已保存';
    status.classList.add('show');
    clearTimeout(saveOptions.hideTimer);
    saveOptions.hideTimer = setTimeout(() => {
      status.classList.remove('show');
    }, 4000);
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
