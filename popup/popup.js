/**
 * Popup script for Zhihu-md extension
 * Handles UI interactions and communication with content script
 */

// ============== Logger System ==============
const Logger = {
  PREFIX: '[Zhihu-MD Popup]',
  STYLES: {
    info: 'color: #2196F3; font-weight: bold;',
    success: 'color: #4CAF50; font-weight: bold;',
    warn: 'color: #FF9800; font-weight: bold;',
    error: 'color: #F44336; font-weight: bold;',
    debug: 'color: #9C27B0; font-weight: bold;'
  },
  
  info: function(...args) {
    console.log(`%c${this.PREFIX} [INFO]`, this.STYLES.info, ...args);
  },
  success: function(...args) {
    console.log(`%c${this.PREFIX} [SUCCESS]`, this.STYLES.success, ...args);
  },
  warn: function(...args) {
    console.warn(`%c${this.PREFIX} [WARN]`, this.STYLES.warn, ...args);
  },
  error: function(...args) {
    console.error(`%c${this.PREFIX} [ERROR]`, this.STYLES.error, ...args);
  },
  debug: function(...args) {
    console.log(`%c${this.PREFIX} [DEBUG]`, this.STYLES.debug, ...args);
  }
};

Logger.info('Popup Script Loaded');

// DOM Elements
const statusBadge = document.getElementById('page-status');
const statusText = statusBadge.querySelector('.status-text');
const articleInfo = document.getElementById('article-info');
const articleTitle = document.getElementById('article-title');
// New selectors based on refactored HTML
const articleAuthor = document.getElementById('article-author').querySelector('span'); // Direct span child
const articleType = document.getElementById('article-type').querySelector('span');     // Direct span child
const errorMessage = document.getElementById('error-message');
const exportBtn = document.getElementById('export-btn');
const settingsBtn = document.getElementById('settings-btn');

/**
 * Update the status badge display
 */
function updateStatus(type, text) {
  // Remove all likely classes first to be safe
  statusBadge.classList.remove('loading', 'success', 'error');
  statusBadge.classList.add(type);
  statusText.textContent = text;
}

/**
 * Show article information
 */
function showArticleInfo(info) {
  articleTitle.textContent = info.title;
  articleAuthor.textContent = info.author || '未知作者';

  // Handle different page types
  let typeLabel;
  switch (info.type) {
    case 'column':
      typeLabel = '专栏文章';
      break;
    case 'answer':
      typeLabel = '回答';
      break;
    case 'question':
      typeLabel = '问题';
      break;
    default:
      typeLabel = '页面';
  }
  articleType.textContent = typeLabel;

  articleInfo.classList.remove('hidden');
  errorMessage.classList.add('hidden'); // Ensure error is hidden
  exportBtn.disabled = false;
}

/**
 * Show error state
 * @param {string} message - Error message to display
 * @param {boolean} silent - If true, don't log to console (for expected cases like non-Zhihu pages)
 */
function showError(message, silent = false) {
  if (!silent) {
    Logger.debug('Show Error:', message);
  }
  updateStatus('error', '失败');

  // Update error message text
  const errorText = errorMessage.querySelector('p');
  if (errorText) errorText.textContent = message;

  errorMessage.classList.remove('hidden');
  articleInfo.classList.add('hidden');
  exportBtn.disabled = true;
}

/**
 * Initialize popup - check current tab and get article info
 */
async function init() {
  Logger.info('Initializing Popup...');
  
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      Logger.error('Cannot get tab info');
      showError('无法访问当前页面');
      return;
    }

    Logger.info('Current URL:', tab.url);

    // Check if the URL is a Zhihu page
    const url = new URL(tab.url);
    
    if (!url.hostname.endsWith('zhihu.com')) {
      showError('此页面不是知乎页面', true);  // Silent - expected case
      return;
    }

    // Determine page type
    const isColumn = url.pathname.startsWith('/p/');
    const isAnswer = url.pathname.includes('/question/') && url.pathname.includes('/answer/');
    const isQuestion = url.pathname.includes('/question/') && !url.pathname.includes('/answer/');

    if (!isColumn && !isAnswer && !isQuestion) {
      showError('请打开知乎文章、问题或回答页面', true);  // Silent - expected case
      return;
    }

    // Send message to content script to get article info
    Logger.info('Sending getArticleInfo to content script...');
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleInfo' });

      Logger.info('Received response:', response);

      if (response && response.success) {
        updateStatus('success', '就绪');

        // Determine type for display
        let displayType = 'page';
        if (isColumn) displayType = 'column';
        else if (isAnswer) displayType = 'answer';
        else if (isQuestion) displayType = 'question';

        showArticleInfo({
          title: response.data.title,
          author: response.data.author,
          type: displayType
        });
      } else {
        throw new Error(response?.error || '解析文章失败');
      }
    } catch (msgError) {
      // If message fails, it might be that content script isn't ready or reloaded
      Logger.warn('Message failed (Content script might be missing):', msgError);
      showError('请刷新页面后重试');
    }

  } catch (error) {
    Logger.error('Init Error:', error);
    showError('未知错误');
  }
}

/**
 * Handle export button click
 */
async function handleExport() {
  Logger.info('Start Export...');
  
  const originalText = exportBtn.querySelector('span').textContent;
  const btnText = exportBtn.querySelector('span');
  
  try {
    exportBtn.classList.add('loading');
    btnText.textContent = '导出中...';
    exportBtn.disabled = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'exportMarkdown' });

    if (response && response.success) {
      Logger.success('Markdown generated');
      
      // Send to background script for download
      await chrome.runtime.sendMessage({
        action: 'download',
        filename: response.data.filename,
        content: response.data.content
      });

      exportBtn.classList.remove('loading');
      // No specific success class needed for styles, but we can reset text
      btnText.textContent = '导出成功!';
      
      setTimeout(() => {
        btnText.textContent = '导出 Markdown';
        exportBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error(response?.error || '导出失败');
    }
  } catch (error) {
    Logger.error('Export Error:', error);
    
    exportBtn.classList.remove('loading');
    btnText.textContent = '导出失败';
    
    setTimeout(() => {
      btnText.textContent = '导出 Markdown';
      exportBtn.disabled = false;
    }, 2000);
  }
}

// Handle Settings Navigation
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });
}

// Event listeners
if (exportBtn) {
  exportBtn.addEventListener('click', handleExport);
}

// Initialize on popup open
init();
