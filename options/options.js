// Saves options to chrome.storage
function saveOptions() {
  const showFloatingBall = document.getElementById('showFloatingBall').checked;
  const maxAnswerCount = parseInt(document.getElementById('maxAnswerCount').value, 10);
  const downloadImages = document.getElementById('downloadImages').checked;

  // Validate range
  const validCount = Math.min(50, Math.max(1, maxAnswerCount || 20));
  document.getElementById('maxAnswerCount').value = validCount;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall,
    maxAnswerCount: validCount,
    downloadImages: downloadImages
  }, () => {
    // Update status to let user know options were saved.
    const status = document.getElementById('status');
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 1500);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
  chrome.storage.sync.get({
    showFloatingBall: true,  // Default value
    maxAnswerCount: 20,      // Default value
    downloadImages: false    // Default value - use remote links
  }, (items) => {
    document.getElementById('showFloatingBall').checked = items.showFloatingBall;
    document.getElementById('maxAnswerCount').value = items.maxAnswerCount;
    document.getElementById('downloadImages').checked = items.downloadImages;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('showFloatingBall').addEventListener('change', saveOptions);
document.getElementById('maxAnswerCount').addEventListener('change', saveOptions);
document.getElementById('downloadImages').addEventListener('change', saveOptions);

