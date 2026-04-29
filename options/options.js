// Saves options to chrome.storage
const Logger = createLogger('[Zhihu-MD Options]');

function saveOptions() {
  const showFloatingBall = document.getElementById('showFloatingBall').checked;
  const maxAnswerCount = parseInt(document.getElementById('maxAnswerCount').value, 10);
  const downloadImages = document.getElementById('downloadImages').checked;

  // Validate: 0 means unlimited, otherwise must be >= 1
  const validCount = Math.max(0, isNaN(maxAnswerCount) ? 20 : maxAnswerCount);
  document.getElementById('maxAnswerCount').value = validCount;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall,
    maxAnswerCount: validCount,
    downloadImages: downloadImages
  }, () => {
    Logger.info('设置已保存:', { showFloatingBall, maxAnswerCount: validCount, downloadImages });
    const status = document.getElementById('status');
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 1500);
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
    document.getElementById('maxAnswerCount').value = items.maxAnswerCount;
    document.getElementById('downloadImages').checked = items.downloadImages;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('showFloatingBall').addEventListener('change', saveOptions);
document.getElementById('maxAnswerCount').addEventListener('change', saveOptions);
document.getElementById('downloadImages').addEventListener('change', saveOptions);

