// Saves options to chrome.storage
function saveOptions() {
  const showFloatingBall = document.getElementById('showFloatingBall').checked;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall
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
    showFloatingBall: true // Default value
  }, (items) => {
    document.getElementById('showFloatingBall').checked = items.showFloatingBall;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('showFloatingBall').addEventListener('change', saveOptions);
