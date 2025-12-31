/**
 * Popup script for Zhihu-md extension
 * Handles UI interactions and communication with content script
 */

// ============== 日志系统 ==============
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

Logger.info('==========================================');
Logger.info('Popup 脚本开始加载...');
Logger.info('==========================================');

// DOM Elements
const statusBadge = document.getElementById('page-status');
const statusText = statusBadge.querySelector('.status-text');
const articleInfo = document.getElementById('article-info');
const articleTitle = document.getElementById('article-title');
const articleAuthor = document.getElementById('article-author').querySelector('span:last-child');
const articleType = document.getElementById('article-type').querySelector('span:last-child');
const errorMessage = document.getElementById('error-message');
const exportBtn = document.getElementById('export-btn');

/**
 * Update the status badge display
 */
function updateStatus(type, text) {
  statusBadge.className = `status-badge ${type}`;
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
      typeLabel = '问答回答';
      break;
    case 'question':
      typeLabel = '问题页面 (多回答)';
      break;
    default:
      typeLabel = '未知类型';
  }
  articleType.textContent = typeLabel;
  articleInfo.classList.remove('hidden');
  errorMessage.classList.add('hidden');
  exportBtn.disabled = false;
}

/**
 * Show error state
 */
function showError(message) {
  Logger.error('显示错误:', message);
  updateStatus('error', '不可用');
  errorMessage.querySelector('span').textContent = message;
  errorMessage.classList.remove('hidden');
  articleInfo.classList.add('hidden');
  exportBtn.disabled = true;
}

/**
 * Initialize popup - check current tab and get article info
 */
async function init() {
  Logger.info('==========================================');
  Logger.info('初始化 Popup...');
  Logger.info('==========================================');
  
  try {
    // Get current active tab
    Logger.debug('正在获取当前活动标签页...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    Logger.debug('标签页信息:', tab);
    
    if (!tab || !tab.url) {
      Logger.error('无法获取标签页信息', { tab });
      showError('无法获取当前页面信息');
      return;
    }

    Logger.info('当前页面 URL:', tab.url);
    Logger.info('标签页 ID:', tab.id);

    // Check if the URL is a Zhihu page
    const url = new URL(tab.url);
    Logger.debug('解析后的 URL 对象:', { hostname: url.hostname, pathname: url.pathname });
    
    if (!url.hostname.endsWith('zhihu.com')) {
      Logger.info('不是知乎页面，hostname:', url.hostname);
      showError('此页面不是知乎页面');
      return;
    }
    
    Logger.success('确认是知乎页面');

    // Determine page type
    const isColumn = url.pathname.startsWith('/p/');
    const isAnswer = url.pathname.includes('/question/') && url.pathname.includes('/answer/');
    const isQuestion = url.pathname.includes('/question/') && !url.pathname.includes('/answer/');
    
    Logger.debug('页面类型判断:', { isColumn, isAnswer, isQuestion, pathname: url.pathname });
    
    if (!isColumn && !isAnswer && !isQuestion) {
      Logger.info('不是专栏、问答或问题页面');
      showError('请打开知乎专栏文章或问答页面');
      return;
    }
    
    let pageTypeLabel;
    if (isColumn) {
      pageTypeLabel = '专栏文章';
    } else if (isAnswer) {
      pageTypeLabel = '问答回答';
    } else {
      pageTypeLabel = '问题页面 (多回答)';
    }
    Logger.success('页面类型:', pageTypeLabel);

    // Send message to content script to get article info
    Logger.info('正在向 content script 发送 getArticleInfo 消息...');
    Logger.debug('目标标签页 ID:', tab.id);
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleInfo' });
    
    Logger.info('收到 content script 响应:', response);
    
    if (response && response.success) {
      Logger.success('成功获取文章信信');
      Logger.debug('文章数据:', response.data);
      updateStatus('success', '已就绪');

      // Determine type for display
      let displayType;
      if (isColumn) {
        displayType = 'column';
      } else if (isAnswer) {
        displayType = 'answer';
      } else {
        displayType = 'question';
      }

      showArticleInfo({
        title: response.data.title,
        author: response.data.author,
        type: displayType
      });
    } else {
      Logger.error('获取文章信息失败:', response?.error);
      showError(response?.error || '无法解析文章内容');
    }
  } catch (error) {
    Logger.error('==========================================');
    Logger.error('初始化过程发生错误!');
    Logger.error('错误对象:', error);
    Logger.error('错误消息:', error.message);
    Logger.error('错误堆栈:', error.stack);
    Logger.error('==========================================');
    
    // Content script might not be injected yet
    if (error.message?.includes('Receiving end does not exist')) {
      Logger.warn('Content script 可能未注入，建议刷新页面');
      showError('请刷新页面后重试');
    } else {
      showError('发生未知错误');
    }
  }
}

/**
 * Handle export button click
 */
async function handleExport() {
  Logger.info('==========================================');
  Logger.info('开始导出 Markdown...');
  Logger.info('==========================================');
  
  const btnText = exportBtn.querySelector('span');
  const originalText = btnText.textContent;
  
  try {
    exportBtn.classList.add('loading');
    btnText.textContent = '导出中...';
    exportBtn.disabled = true;

    // Get current active tab
    Logger.debug('获取当前标签页...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    Logger.debug('标签页 ID:', tab.id);
    
    // Send message to content script to export markdown
    Logger.info('发送 exportMarkdown 消息到 content script...');
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'exportMarkdown' });
    
    Logger.info('Content script 响应:', response);
    
    if (response && response.success) {
      Logger.success('Markdown 生成成功');
      Logger.debug('文件名:', response.data.filename);
      Logger.debug('内容长度:', response.data.content?.length || 0, '字符');
      
      // Send to background script for download
      Logger.info('发送下载请求到 background script...');
      await chrome.runtime.sendMessage({
        action: 'download',
        filename: response.data.filename,
        content: response.data.content
      });
      
      Logger.success('下载请求已发送');

      exportBtn.classList.remove('loading');
      exportBtn.classList.add('success');
      btnText.textContent = '导出成功!';
      
      setTimeout(() => {
        exportBtn.classList.remove('success');
        btnText.textContent = originalText;
        exportBtn.disabled = false;
      }, 2000);
    } else {
      Logger.error('导出失败:', response?.error);
      throw new Error(response?.error || '导出失败');
    }
  } catch (error) {
    Logger.error('==========================================');
    Logger.error('导出过程发生错误!');
    Logger.error('错误对象:', error);
    Logger.error('错误消息:', error.message);
    Logger.error('错误堆栈:', error.stack);
    Logger.error('==========================================');
    
    exportBtn.classList.remove('loading');
    btnText.textContent = '导出失败';
    
    setTimeout(() => {
      btnText.textContent = originalText;
      exportBtn.disabled = false;
    }, 2000);
  }
}

// Event listeners
exportBtn.addEventListener('click', handleExport);

// Initialize on popup open
init();
