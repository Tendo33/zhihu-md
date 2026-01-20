/**
 * Background service worker for Zhihu-md extension
 * Handles file downloads and image packaging
 */

// ============== Logger System ==============
importScripts('/lib/logger.js');
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
        .then(() => {
          Logger.success('带图片下载完成');
          sendResponse({ success: true });
        })
        .catch(error => {
          Logger.error('带图片下载失败:', error);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      handleDownload(message.filename, message.content)
        .then(() => {
          Logger.success('下载完成');
          sendResponse({ success: true });
        })
        .catch(error => {
          Logger.error('下载失败:', error);
          sendResponse({ success: false, error: error.message });
        });
    }
    return true;
  } else {
    Logger.warn('未知的消息类型:', message.action);
  }
});

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

/**
 * Handle download with images - creates a ZIP file
 * @param {string} filename 
 * @param {string} content 
 * @param {Array} images - Array of {url, filename}
 */
async function handleDownloadWithImages(filename, content, images) {
  Logger.info(`开始下载 ${images.length} 张图片...`);
  
  // Download all images
  const imageData = await downloadImages(images);
  
  // Create ZIP file
  const zipBlob = await createZipWithImages(filename, content, imageData);
  
  // Download ZIP
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        const zipFilename = filename.replace('.md', '') + '_with_images.zip';
        
        await chrome.downloads.download({
          url: dataUrl,
          filename: zipFilename,
          saveAs: true
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to create ZIP'));
    reader.readAsDataURL(zipBlob);
  });
}

/**
 * Download all images and return as array of {filename, data}
 * @param {Array} images 
 * @returns {Promise<Array>}
 */
async function downloadImages(images) {
  const results = [];
  
  for (const img of images) {
    try {
      Logger.debug(`下载图片: ${img.url.substring(0, 50)}...`);
      
      const response = await fetch(img.url);
      if (!response.ok) {
        Logger.warn(`图片下载失败: ${img.url}`);
        continue;
      }
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      results.push({
        filename: img.filename,
        data: new Uint8Array(arrayBuffer)
      });
    } catch (error) {
      Logger.warn(`图片下载错误: ${img.url}`, error);
    }
  }
  
  Logger.info(`成功下载 ${results.length}/${images.length} 张图片`);
  return results;
}

/**
 * Create a ZIP file containing markdown and images
 * Uses a simple ZIP implementation without external libraries
 * @param {string} mdFilename 
 * @param {string} mdContent 
 * @param {Array} images 
 * @returns {Promise<Blob>}
 */
async function createZipWithImages(mdFilename, mdContent, images) {
  const files = [
    { name: mdFilename, content: new TextEncoder().encode(mdContent) }
  ];
  
  // Add images to the images/ folder
  for (const img of images) {
    files.push({
      name: `images/${img.filename}`,
      content: img.data
    });
  }
  
  return createZip(files);
}

/**
 * Simple ZIP file creator (no compression, store only)
 * Supports UTF-8 filenames for Chinese characters
 * @param {Array} files - Array of {name, content}
 * @returns {Blob}
 */
function createZip(files) {
  const parts = [];
  const centralDirectory = [];
  let offset = 0;
  
  // UTF-8 flag (bit 11) for proper Chinese filename support
  const UTF8_FLAG = 0x0800;
  
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const content = file.content;
    const crcValue = crc32(content);
    
    // Local file header
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    
    localView.setUint32(0, 0x04034b50, true);  // Local file header signature
    localView.setUint16(4, 20, true);           // Version needed (2.0 for UTF-8)
    localView.setUint16(6, UTF8_FLAG, true);    // General purpose bit flag - UTF-8 encoding
    localView.setUint16(8, 0, true);            // Compression method (store)
    localView.setUint16(10, 0, true);           // File last modification time
    localView.setUint16(12, 0, true);           // File last modification date
    localView.setUint32(14, crcValue, true);    // CRC-32
    localView.setUint32(18, content.length, true);  // Compressed size
    localView.setUint32(22, content.length, true);  // Uncompressed size
    localView.setUint16(26, nameBytes.length, true); // File name length
    localView.setUint16(28, 0, true);           // Extra field length
    
    // Copy filename
    new Uint8Array(localHeader, 30).set(nameBytes);
    
    // Central directory header
    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    
    centralView.setUint32(0, 0x02014b50, true); // Central file header signature
    centralView.setUint16(4, 0x0314, true);      // Version made by (Unix + ZIP 2.0)
    centralView.setUint16(6, 20, true);          // Version needed (2.0 for UTF-8)
    centralView.setUint16(8, UTF8_FLAG, true);   // General purpose bit flag - UTF-8 encoding
    centralView.setUint16(10, 0, true);          // Compression method
    centralView.setUint16(12, 0, true);          // File last modification time
    centralView.setUint16(14, 0, true);          // File last modification date
    centralView.setUint32(16, crcValue, true);   // CRC-32
    centralView.setUint32(20, content.length, true); // Compressed size
    centralView.setUint32(24, content.length, true); // Uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // File name length
    centralView.setUint16(30, 0, true);          // Extra field length
    centralView.setUint16(32, 0, true);          // File comment length
    centralView.setUint16(34, 0, true);          // Disk number start
    centralView.setUint16(36, 0, true);          // Internal file attributes
    centralView.setUint32(38, 0, true);          // External file attributes
    centralView.setUint32(42, offset, true);     // Relative offset of local header
    
    new Uint8Array(centralHeader, 46).set(nameBytes);
    
    parts.push(new Uint8Array(localHeader));
    parts.push(content);
    centralDirectory.push(new Uint8Array(centralHeader));
    
    offset += localHeader.byteLength + content.length;
  }
  
  // End of central directory
  const centralDirSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0);
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  
  endView.setUint32(0, 0x06054b50, true);       // End of central dir signature
  endView.setUint16(4, 0, true);                // Number of this disk
  endView.setUint16(6, 0, true);                // Disk where central directory starts
  endView.setUint16(8, files.length, true);     // Number of central directory records on this disk
  endView.setUint16(10, files.length, true);    // Total number of central directory records
  endView.setUint32(12, centralDirSize, true);  // Size of central directory
  endView.setUint32(16, offset, true);          // Offset of start of central directory
  endView.setUint16(20, 0, true);               // Comment length
  
  return new Blob([...parts, ...centralDirectory, new Uint8Array(endRecord)], { type: 'application/zip' });
}

/**
 * Calculate CRC-32 checksum
 * @param {Uint8Array} data 
 * @returns {number}
 */
function crc32(data) {
  let crc = 0xFFFFFFFF;
  
  // CRC-32 lookup table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
