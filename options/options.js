import { createLogger } from '../lib/logger.js';
import { capAnswerCount, normalizeAnswerCount } from '../lib/answer-limit.js';

const Logger = createLogger('[Zhihu-MD Options]');

function saveOptions() {
  const showFloatingBall = document.getElementById('showFloatingBall').checked;
  const { value: validCount, note: countNote } = normalizeAnswerCount(document.getElementById('maxAnswerCount').value);
  const downloadImages = document.getElementById('downloadImages').checked;

  document.getElementById('maxAnswerCount').value = validCount;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall,
    maxAnswerCount: validCount,
    downloadImages: downloadImages
  }, () => {
    Logger.info('设置已保存:', { showFloatingBall, maxAnswerCount: validCount, downloadImages });
    // 设计 M3：页脚左侧「✓ 已保存」，2.5 秒后淡出；被上限或下限改值时在数字框下方留一行警示，保留到下次修改
    const note = document.getElementById('note-maxAnswerCount');
    if (note) note.textContent = countNote;
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
