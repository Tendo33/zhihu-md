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
  articleAuthor.textContent = info.author || 'Unknown Author';

  // Handle different page types
  let typeLabel;
  switch (info.type) {
    case 'column':
      typeLabel = 'Column';
      break;
    case 'answer':
      typeLabel = 'Answer';
      break;
    case 'question':
      typeLabel = 'Question';
      break;
    default:
      typeLabel = 'Page';
  }
  articleType.textContent = typeLabel;

  articleInfo.classList.remove('hidden');
  errorMessage.classList.add('hidden'); // Ensure error is hidden
  exportBtn.disabled = false;
}

/**
 * Show error state
 */
function showError(message) {
  Logger.error('Show Error:', message);
  updateStatus('error', 'Failed');

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
      showError('Cannot access current page');
      return;
    }

    Logger.info('Current URL:', tab.url);

    // Check if the URL is a Zhihu page
    const url = new URL(tab.url);
    
    if (!url.hostname.endsWith('zhihu.com')) {
      showError('Not a Zhihu page');
      return;
    }

    // Determine page type
    const isColumn = url.pathname.startsWith('/p/');
    const isAnswer = url.pathname.includes('/question/') && url.pathname.includes('/answer/');
    const isQuestion = url.pathname.includes('/question/') && !url.pathname.includes('/answer/');

    if (!isColumn && !isAnswer && !isQuestion) {
      showError('Please open a Zhihu Article, Question or Answer');
      return;
    }

    // Send message to content script to get article info
    Logger.info('Sending getArticleInfo to content script...');
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleInfo' });

      Logger.info('Received response:', response);

      if (response && response.success) {
        updateStatus('success', 'Ready');

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
        throw new Error(response?.error || 'Failed to parse article');
      }
    } catch (msgError) {
      // If message fails, it might be that content script isn't ready or reloaded
      Logger.warn('Message failed (Content script might be missing):', msgError);
      showError('Please refresh the page');
    }

  } catch (error) {
    Logger.error('Init Error:', error);
    showError('Unknown error occurred');
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
    btnText.textContent = 'Exporting...';
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
      btnText.textContent = 'Success!';
      
      setTimeout(() => {
        btnText.textContent = 'Export Markdown';
        exportBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error(response?.error || 'Export failed');
    }
  } catch (error) {
    Logger.error('Export Error:', error);
    
    exportBtn.classList.remove('loading');
    btnText.textContent = 'Failed';
    
    setTimeout(() => {
      btnText.textContent = 'Export Markdown';
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
