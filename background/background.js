/**
 * Background service worker for Zhihu-md extension
 * Handles file downloads
 */

// ============== 日志系统 ==============
// Import shared logger for service worker
importScripts('/lib/logger.js');
const Logger = createLogger('[Zhihu-MD Background]');

Logger.info('==========================================');
Logger.info('Background service worker 开始加载...');
Logger.info('==========================================');

// Listen for download requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.info('收到消息:', message);
  Logger.debug('消息来源:', sender);
  
  if (message.action === 'download') {
    Logger.info('处理下载请求，文件名:', message.filename);
    Logger.debug('内容长度:', message.content?.length || 0, '字符');
    
    handleDownload(message.filename, message.content)
      .then(() => {
        Logger.success('下载完成');
        sendResponse({ success: true });
      })
      .catch(error => {
        Logger.error('下载失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  } else {
    Logger.warn('未知的消息类型:', message.action);
  }
});

/**
 * Handle file download
 */
async function handleDownload(filename, content) {
  // Create a Blob with the content
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  
  // Convert to data URL
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        
        // Trigger download
        await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        });
        
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}
