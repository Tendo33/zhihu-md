/**
 * Background service worker for Zhihu-md extension
 * Handles file downloads and image packaging
 */

import { createLogger } from '../lib/logger.js';
import { createZipWithImages } from '../lib/zip.js';
import { recordRecent, titleFromFilename } from '../lib/recent-exports.js';
import { applyImageResults, isAllowedImageUrl } from '../lib/image-pack.js';
import { createMenus, handleMenuClick, openAndWait, showLinkFailure } from './context-menu.js';

const Logger = createLogger('[Zhihu-MD Background]');

Logger.info('==========================================');
Logger.info('Background service worker 开始加载...');
Logger.info('==========================================');

// Listen for download requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.info('收到消息:', message);
  
  if (message.action === 'download') {
    Logger.info('处理下载请求，文件名:', message.filename);
    
    // Check if we need to download images
    if (message.downloadImages && message.images && message.images.length > 0) {
      handleDownloadWithImages(message.filename, message.content, message.images)
        .then((info) => {
          Logger.success('带图片下载完成');
          remember(message, true);
          sendResponse({ success: true, ...info });
        })
        .catch(error => {
          Logger.error('带图片下载失败:', error);
          remember(message, false);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      handleDownload(message.filename, message.content)
        .then((info) => {
          Logger.success('下载完成');
          remember(message, true);
          sendResponse({ success: true, ...info });
        })
        .catch(error => {
          Logger.error('下载失败:', error);
          remember(message, false);
          sendResponse({ success: false, error: error.message });
        });
    }
    return true;
  } else if (message.action === 'recordExport') {
    // 悬浮球导出失败时也记进「最近导出」
    remember(message, !!message.ok);
  } else {
    Logger.warn('未知的消息类型:', message.action);
  }
});

/** Round 3 C-2：popup「最近导出」 */
function remember(message, ok) {
  const title = message.title || titleFromFilename(message.filename);
  recordRecent(chrome.storage, { title, ok }).catch((e) => Logger.warn('记录最近导出失败', e));
}

/**
 * Handle simple file download (no images)
 * @param {string} filename 
 * @param {string} content 
 */
async function handleDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        const downloadId = await chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        });
        resolve({ downloadId, filename });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Handle download with images - creates a ZIP file
 * @param {string} filename 
 * @param {string} content 
 * @param {Array} images - Array of {url, filename}
 */
async function handleDownloadWithImages(filename, content, images) {
  Logger.info(`开始下载 ${images.length} 张图片...`);
  
  // Download all images
  // 发版 QA ZR-09：失败的图片在正文里退回在线链接；成功的按实际格式定扩展名
  const packed = applyImageResults(content, images, await downloadImages(images));
  
  // Create ZIP file
  const zipBlob = await createZipWithImages(filename, packed.content, packed.files);
  
  // Download ZIP
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        const zipFilename = filename.replace('.md', '') + '_with_images.zip';
        
        const downloadId = await chrome.downloads.download({
          url: dataUrl,
          filename: zipFilename,
          saveAs: true
        });
        resolve({ downloadId, filename: zipFilename, failedImages: packed.failed });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to create ZIP'));
    reader.readAsDataURL(zipBlob);
  });
}

/**
 * Download all images in parallel and return as array of {filename, data}
 * @param {Array} images 
 * @returns {Promise<Array>}
 */
async function downloadImages(images) {
  const results = await Promise.allSettled(
    images.map(async (img) => {
      Logger.debug(`下载图片: ${img.url.substring(0, 50)}...`);
      if (!isAllowedImageUrl(img.url)) throw new Error('只下载 https://*.zhimg.com 的图片');
      // 审查 P3（release-polish-2 ①）：不跟随重定向，避免 zhimg 30x 跳到白名单外的主机
      const response = await fetch(img.url, { redirect: 'error' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return { ok: true, data: new Uint8Array(arrayBuffer), contentType: response.headers?.get?.('content-type') || blob.type };
    })
  );

  const out = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    Logger.warn(`图片下载失败: ${images[i].url}`, result.reason);
    return { ok: false };
  });

  Logger.info(`成功下载 ${out.filter((r) => r.ok).length}/${images.length} 张图片`);
  return out;
}


// Round 3：快捷键导出当前页（manifest commands.export-page，默认 Alt+Shift+K；不需要权限）
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'export-page') return;
    triggerExportInTab(tab).catch((e) => Logger.warn('快捷键导出未送达', e && e.message));
  });
}

export async function triggerExportInTab(tab) {
  const target = tab && tab.id != null ? tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!target || target.id == null) return { success: false };
  return chrome.tabs.sendMessage(target.id, { action: 'triggerExport' });
}

// Round 3 C-3：右键菜单
if (chrome.contextMenus) {
  chrome.runtime.onInstalled.addListener(() => createMenus(chrome.contextMenus));
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    handleMenuClick(info, tab, {
      tabs: chrome.tabs,
      openAndWait: (props) => openAndWait(chrome.tabs, props),
      notifyFailure: (tabId) => showLinkFailure(chrome.action, tabId),
    })
      .catch((e) => Logger.warn('右键菜单操作未送达', e && e.message));
  });
}
