/**
 * Content script for Zhihu-md extension
 * Parses Zhihu article DOM and converts to Markdown
 */

(function() {
  'use strict';

  // ============== 日志系统 ==============
  const Logger = {
    PREFIX: '[Zhihu-MD Content]',
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
    },
    group: function(label) {
      console.group(`${this.PREFIX} ${label}`);
    },
    groupEnd: function() {
      console.groupEnd();
    }
  };

  Logger.info('==========================================');
  Logger.info('Content script 开始加载...');
  Logger.info('当前URL:', window.location.href);
  Logger.info('当前路径:', window.location.pathname);
  Logger.info('==========================================');

  // Prevent multiple injections
  if (window.__zhihuMdInjected) {
    Logger.warn('脚本已经注入过，跳过重复注入');
    return;
  }
  window.__zhihuMdInjected = true;
  Logger.success('脚本注入标记设置成功');

  // 检查 TurndownService 是否可用
  if (typeof TurndownService === 'undefined') {
    Logger.error('TurndownService 未加载！请检查 turndown.min.js 是否正确引入');
  } else {
    Logger.success('TurndownService 已加载');
  }

  /**
   * Detect page type (column article or answer)
   */
  function detectPageType() {
    const pathname = window.location.pathname;
    Logger.debug('检测页面类型，路径:', pathname);
    
    if (pathname.startsWith('/p/')) {
      Logger.info('页面类型: 专栏文章 (column)');
      return 'column';
    }
    if (pathname.includes('/question/') && pathname.includes('/answer/')) {
      Logger.info('页面类型: 问答回答 (answer)');
      return 'answer';
    }
    
    Logger.warn('无法识别的页面类型，路径:', pathname);
    return null;
  }

  /**
   * Get article content container based on page type
   */
  function getContentContainer(pageType) {
    Logger.group('查找内容容器');
    Logger.debug('页面类型:', pageType);
    
    let container = null;
    
    if (pageType === 'column') {
      Logger.debug('尝试查找专栏内容容器...');
      container = document.querySelector('.Post-RichText') || 
                  document.querySelector('.RichText.ztext.Post-RichText');
      Logger.debug('.Post-RichText 查找结果:', container ? '找到' : '未找到');
    } else if (pageType === 'answer') {
      Logger.debug('尝试查找问答内容容器...');
      // For answer pages, find the specific answer content
      const answerMatch = window.location.pathname.match(/\/answer\/(\d+)/);
      Logger.debug('回答 ID 匹配结果:', answerMatch);
      
      if (answerMatch) {
        const answerId = answerMatch[1];
        Logger.debug('回答 ID:', answerId);
        const answerElement = document.querySelector(`[data-za-detail-view-id="${answerId}"]`) ||
                              document.querySelector('.AnswerItem .RichText');
        Logger.debug('回答元素查找结果:', answerElement ? '找到' : '未找到');
        container = answerElement?.querySelector('.RichText') || answerElement;
      } else {
        container = document.querySelector('.AnswerItem .RichText');
      }
      Logger.debug('.AnswerItem .RichText 查找结果:', container ? '找到' : '未找到');
    }
    
    if (container) {
      Logger.success('内容容器找到!');
      Logger.debug('容器元素:', container.tagName, container.className);
      Logger.debug('容器 HTML 长度:', container.innerHTML?.length || 0, '字符');
    } else {
      Logger.error('未找到内容容器!');
      Logger.debug('当前页面所有 class:');
      Logger.debug(Array.from(document.querySelectorAll('*')).map(el => el.className).filter(c => c).slice(0, 50));
    }
    
    Logger.groupEnd();
    return container;
  }

  /**
   * Get article title
   */
  function getTitle(pageType) {
    if (pageType === 'column') {
      return document.querySelector('.Post-Title')?.textContent?.trim() ||
             document.querySelector('h1.Post-Title')?.textContent?.trim();
    } else if (pageType === 'answer') {
      return document.querySelector('.QuestionHeader-title')?.textContent?.trim();
    }
    return document.title;
  }

  /**
   * Get author name
   */
  function getAuthor(pageType) {
    if (pageType === 'column') {
      return document.querySelector('.AuthorInfo-name')?.textContent?.trim() ||
             document.querySelector('.UserLink-link')?.textContent?.trim();
    } else if (pageType === 'answer') {
      const answerItem = document.querySelector('.AnswerItem');
      return answerItem?.querySelector('.AuthorInfo-name')?.textContent?.trim() ||
             answerItem?.querySelector('.UserLink-link')?.textContent?.trim();
    }
    return null;
  }

  /**
   * Configure Turndown with custom rules for Zhihu
   */
  function createTurndownService() {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });

    // Rule: Math formulas - extract LaTeX from data-tex attribute
    turndownService.addRule('zhihuMath', {
      filter: function(node) {
        return node.classList && node.classList.contains('ztext-math');
      },
      replacement: function(content, node) {
        const tex = node.getAttribute('data-tex') || content;
        // Check if it's a block-level formula (usually wrapped in a dedicated container)
        const isBlock = node.parentElement?.classList?.contains('ztext-math-container') ||
                        node.closest('.ztext-math-container');
        if (isBlock) {
          return `\n\n$$${tex}$$\n\n`;
        }
        return `$${tex}$`;
      }
    });

    // Rule: High-resolution images
    turndownService.addRule('zhihuImage', {
      filter: 'img',
      replacement: function(content, node) {
        // Priority: data-original > data-actualsrc > data-src > src
        const src = node.getAttribute('data-original') ||
                    node.getAttribute('data-actualsrc') ||
                    node.getAttribute('data-src') ||
                    node.getAttribute('src');
        
        if (!src) return '';
        
        const alt = node.getAttribute('alt') || '图片';
        // Clean up the URL (remove query params that might cause issues)
        let cleanSrc = src;
        if (cleanSrc.includes('zhimg.com')) {
          // Keep the high-res version
          cleanSrc = cleanSrc.replace(/_\w+\./, '.'); // Remove size suffix if present
        }
        
        return `![${alt}](${cleanSrc})`;
      }
    });

    // Rule: Code blocks with language detection
    turndownService.addRule('zhihuCodeBlock', {
      filter: function(node) {
        return node.nodeName === 'PRE' || 
               (node.nodeName === 'DIV' && node.classList.contains('highlight'));
      },
      replacement: function(content, node) {
        let code = '';
        let language = '';

        // Find the code element
        const codeElement = node.querySelector('code') || node;
        
        // Detect language from class
        const classes = Array.from(codeElement.classList || []);
        for (const cls of classes) {
          if (cls.startsWith('language-')) {
            language = cls.replace('language-', '');
            break;
          }
          if (cls.startsWith('lang-')) {
            language = cls.replace('lang-', '');
            break;
          }
        }

        // Get the code content
        code = codeElement.textContent || '';
        
        return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
      }
    });

    // Rule: Link cards - convert to simple links
    turndownService.addRule('zhihuLinkCard', {
      filter: function(node) {
        return node.classList && 
               (node.classList.contains('LinkCard') || 
                node.classList.contains('RichText-LinkCardContainer'));
      },
      replacement: function(content, node) {
        const link = node.querySelector('a');
        if (!link) return '';
        
        const href = link.getAttribute('href') || '';
        const title = node.querySelector('.LinkCard-title')?.textContent ||
                      link.textContent?.trim() ||
                      '链接';
        
        // Clean up Zhihu redirect links
        let cleanHref = href;
        if (href.includes('link.zhihu.com')) {
          try {
            const url = new URL(href);
            cleanHref = url.searchParams.get('target') || href;
          } catch {}
        }
        
        return `[${title}](${cleanHref})`;
      }
    });

    // Rule: Blockquotes
    turndownService.addRule('zhihuBlockquote', {
      filter: 'blockquote',
      replacement: function(content) {
        const lines = content.trim().split('\n');
        return '\n\n' + lines.map(line => `> ${line}`).join('\n') + '\n\n';
      }
    });

    // Rule: Video placeholders
    turndownService.addRule('zhihuVideo', {
      filter: function(node) {
        return node.classList && node.classList.contains('VideoCard');
      },
      replacement: function(content, node) {
        const link = node.querySelector('a');
        const href = link?.getAttribute('href') || '';
        return `[视频](${href})`;
      }
    });

    return turndownService;
  }

  /**
   * Generate YAML front matter
   */
  function generateFrontMatter(title, author, url) {
    const date = new Date().toISOString().split('T')[0];
    return `---
title: "${title.replace(/"/g, '\\"')}"
url: ${url}
author: ${author || '未知'}
date: ${date}
---

`;
  }

  /**
   * Clean filename - remove illegal characters
   */
  function cleanFilename(title) {
    return title
      .replace(/[/\\:*?"<>|]/g, '_')  // Replace illegal chars
      .replace(/\s+/g, '_')            // Replace spaces
      .replace(/_+/g, '_')             // Collapse multiple underscores
      .replace(/^_|_$/g, '')           // Trim underscores
      .substring(0, 100);              // Limit length
  }

  /**
   * Get article info (for popup display)
   */
  function getArticleInfo() {
    Logger.info('==========================================');
    Logger.info('获取文章信息...');
    Logger.info('==========================================');
    
    const pageType = detectPageType();
    if (!pageType) {
      Logger.error('页面类型无效');
      return { success: false, error: '不是有效的知乎文章页面' };
    }

    const title = getTitle(pageType);
    const author = getAuthor(pageType);
    const container = getContentContainer(pageType);
    
    Logger.debug('标题:', title);
    Logger.debug('作者:', author);
    Logger.debug('内容容器:', container ? '已找到' : '未找到');

    if (!container) {
      Logger.error('无法找到文章内容容器');
      return { success: false, error: '无法找到文章内容' };
    }

    const result = {
      success: true,
      data: {
        title: title || '未知标题',
        author: author || '未知作者',
        type: pageType
      }
    };
    
    Logger.success('文章信息获取成功:', result);
    return result;
  }

  /**
   * Export article as Markdown
   */
  function exportMarkdown() {
    Logger.info('==========================================');
    Logger.info('开始导出 Markdown...');
    Logger.info('==========================================');
    
    const pageType = detectPageType();
    if (!pageType) {
      Logger.error('页面类型无效');
      return { success: false, error: '不是有效的知乎文章页面' };
    }

    const title = getTitle(pageType);
    const author = getAuthor(pageType);
    const container = getContentContainer(pageType);
    
    Logger.debug('标题:', title);
    Logger.debug('作者:', author);

    if (!container) {
      Logger.error('内容容器未找到');
      return { success: false, error: '无法找到文章内容' };
    }

    try {
      Logger.debug('克隆容器节点...');
      // Clone the container to avoid modifying the original DOM
      const clonedContainer = container.cloneNode(true);
      
      // Pre-process: Remove unwanted elements
      const unwantedSelectors = [
        '.ContentItem-actions',    // Action buttons
        '.RichText-ADLinkCardContainer', // Ad cards
        '.AdblockBanner',          // Adblock banners
        '.Reward',                 // Reward/tip section
        '.Post-topicsAndReviewer', // Topics section
        '.FollowButton',           // Follow buttons
      ];
      
      Logger.debug('移除不需要的元素...');
      unwantedSelectors.forEach(selector => {
        const removed = clonedContainer.querySelectorAll(selector);
        Logger.debug(`移除 ${selector}:`, removed.length, '个');
        removed.forEach(el => el.remove());
      });

      // Pre-process: Remove duplicate images (Zhihu often has multiple versions of the same image)
      // Also remove noscript tags which contain backup images
      Logger.debug('移除重复图片和 noscript 标签...');
      const noscriptTags = clonedContainer.querySelectorAll('noscript');
      Logger.debug('移除 noscript 标签:', noscriptTags.length, '个');
      noscriptTags.forEach(el => el.remove());

      // Remove duplicate images by tracking unique image sources
      const seenImageSources = new Set();
      const allImages = clonedContainer.querySelectorAll('img');
      Logger.debug('发现图片总数:', allImages.length);
      
      allImages.forEach(img => {
        // Get the base image URL (remove size suffix and query params for comparison)
        const src = img.getAttribute('data-original') ||
                    img.getAttribute('data-actualsrc') ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('src') || '';
        
        // Extract base URL for comparison (remove _720w, _hd, etc. suffixes and query params)
        const baseUrl = src.replace(/_\d+w\./, '.').replace(/_[a-z]+\./, '.').split('?')[0];
        
        if (seenImageSources.has(baseUrl)) {
          Logger.debug('移除重复图片:', baseUrl.substring(0, 50) + '...');
          img.remove();
        } else {
          seenImageSources.add(baseUrl);
        }
      });

      // Convert to Markdown
      Logger.debug('创建 Turndown 服务...');
      const turndownService = createTurndownService();
      
      Logger.debug('转换为 Markdown...');
      let markdown = turndownService.turndown(clonedContainer);
      Logger.debug('Markdown 原始长度:', markdown.length, '字符');

      // Add front matter
      Logger.debug('添加 front matter...');
      const frontMatter = generateFrontMatter(title, author, window.location.href);
      markdown = frontMatter + markdown;

      // Clean up extra newlines
      markdown = markdown.replace(/\n{3,}/g, '\n\n');
      Logger.debug('Markdown 最终长度:', markdown.length, '字符');

      // Generate filename
      const filename = cleanFilename(title || 'zhihu-article') + '.md';
      Logger.debug('生成文件名:', filename);

      const result = {
        success: true,
        data: {
          content: markdown,
          filename: filename
        }
      };
      
      Logger.success('Markdown 导出成功!');
      Logger.debug('Markdown 预览 (前 500 字符):', markdown.substring(0, 500));
      
      return result;
    } catch (error) {
      Logger.error('==========================================');
      Logger.error('导出过程发生错误!');
      Logger.error('错误对象:', error);
      Logger.error('错误消息:', error.message);
      Logger.error('错误堆栈:', error.stack);
      Logger.error('==========================================');
      return { success: false, error: '导出过程中发生错误: ' + error.message };
    }
  }

  // Listen for messages from popup
  Logger.info('注册消息监听器...');
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    Logger.info('==========================================');
    Logger.info('收到消息:', message);
    Logger.debug('消息来源:', sender);
    Logger.info('==========================================');
    
    if (message.action === 'getArticleInfo') {
      Logger.info('处理 getArticleInfo 请求...');
      const result = getArticleInfo();
      Logger.info('返回结果:', result);
      sendResponse(result);
    } else if (message.action === 'exportMarkdown') {
      Logger.info('处理 exportMarkdown 请求...');
      const result = exportMarkdown();
      Logger.info('返回结果:', result.success ? '成功' : '失败');
      sendResponse(result);
    } else {
      Logger.warn('未知的消息类型:', message.action);
    }
    return true; // Keep the message channel open for async response
  });
  
  Logger.success('消息监听器注册成功!');
  Logger.info('Content script 初始化完成!');

})();
