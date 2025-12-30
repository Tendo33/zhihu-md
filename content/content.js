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

  // ============== 悬浮球功能 ==============

  /**
   * 检查是否为有效的知乎文章页面
   */
  function isValidArticlePage() {
    const pageType = detectPageType();
    return pageType !== null;
  }

  /**
   * 注入悬浮球样式
   */
  function injectFloatingBallStyles() {
    if (document.getElementById('zhihu-md-floating-styles')) {
      return; // 样式已注入
    }

    const styles = document.createElement('style');
    styles.id = 'zhihu-md-floating-styles';
    styles.textContent = `

      /* 悬浮球容器 */
      #zhihu-md-floating-ball {
        position: fixed;
        right: 32px;
        bottom: 32px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        /* Modern Gradient - Deep Blue */
        background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
        /* Soft, colored shadow for "glow" effect */
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35),
                    0 4px 12px rgba(0, 0, 0, 0.1),
                    inset 0 1px 1px rgba(255, 255, 255, 0.2);
        cursor: pointer;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
      }

      /* Hover State - Lift and Glow */
      #zhihu-md-floating-ball:hover {
        transform: translateY(-4px) scale(1.05);
        box-shadow: 0 12px 28px rgba(37, 99, 235, 0.45),
                    0 6px 16px rgba(0, 0, 0, 0.12),
                    inset 0 1px 1px rgba(255, 255, 255, 0.3);
      }

      /* Active/Click State - Press down */
      #zhihu-md-floating-ball:active {
        transform: translateY(0) scale(0.92);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3),
                    0 2px 8px rgba(0, 0, 0, 0.1);
      }

      /* Dragging State */
      #zhihu-md-floating-ball.dragging {
        transition: none;
        opacity: 0.95;
        cursor: move;
        transform: scale(1.0);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      }

      /* Icon styling */
      #zhihu-md-floating-ball .icon {
        width: 26px;
        height: 26px;
        color: white;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }

      #zhihu-md-floating-ball:hover .icon {
        transform: scale(1.1);
      }

      /* 加载状态 - Loading */
      #zhihu-md-floating-ball.loading {
        pointer-events: none;
        background: linear-gradient(135deg, #4B5563 0%, #374151 100%);
        box-shadow: 0 8px 20px rgba(75, 85, 99, 0.35);
      }

      #zhihu-md-floating-ball.loading .icon {
        animation: zhihu-md-spin 1s cubic-bezier(0.55, 0.055, 0.675, 0.19) infinite;
      }

      @keyframes zhihu-md-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* 成功状态 - Success */
      #zhihu-md-floating-ball.success {
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35),
                    inset 0 1px 1px rgba(255, 255, 255, 0.2);
      }

      #zhihu-md-floating-ball.success .icon {
        transform: scale(1.1);
      }

      /* 错误状态 - Error */
      #zhihu-md-floating-ball.error {
        background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
        box-shadow: 0 8px 20px rgba(239, 68, 68, 0.35),
                    inset 0 1px 1px rgba(255, 255, 255, 0.2);
      }

      /* Modern Tooltip */
      #zhihu-md-floating-ball .tooltip {
        position: absolute;
        right: 70px; /* Position to the left */
        top: 50%;
        transform: translateY(-50%) translateX(10px);
        padding: 8px 14px;
        background: rgba(17, 24, 39, 0.9);
        color: white;
        font-size: 13px;
        font-weight: 500;
        border-radius: 8px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(4px);
      }

      /* Tooltip Arrow */
      #zhihu-md-floating-ball .tooltip::after {
        content: '';
        position: absolute;
        left: 100%; /* Arrow on the right side of tooltip */
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: rgba(17, 24, 39, 0.9);
      }

      #zhihu-md-floating-ball:hover .tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(-50%) translateX(0);
      }

      #zhihu-md-floating-ball.dragging .tooltip {
        opacity: 0;
        visibility: hidden;
      }
    `;
    document.head.appendChild(styles);
    Logger.success('悬浮球样式注入成功');
  }

  /**
   * 创建悬浮球DOM元素
   */
  function createFloatingBall() {
    if (document.getElementById('zhihu-md-floating-ball')) {
      return document.getElementById('zhihu-md-floating-ball');
    }

    const ball = document.createElement('div');
    ball.id = 'zhihu-md-floating-ball';
    ball.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3V15M12 15L7 10M12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
      </svg>
      <span class="tooltip">导出 Markdown</span>
    `;

    document.body.appendChild(ball);
    Logger.success('悬浮球DOM创建成功');
    return ball;
  }

  /**
   * 初始化悬浮球拖拽功能
   */
  function initDrag(ball) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, startLeft, startBottom;

    ball.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // 仅左键

      isDragging = true;
      hasMoved = false;
      ball.classList.add('dragging');

      const rect = ball.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startBottom = window.innerHeight - rect.bottom;

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // 如果移动超过5px，认为是拖拽
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved = true;
      }

      const newLeft = startLeft + deltaX;
      const newBottom = startBottom - deltaY;

      // 边界限制
      const maxLeft = window.innerWidth - ball.offsetWidth;
      const maxBottom = window.innerHeight - ball.offsetHeight;

      ball.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      ball.style.bottom = Math.max(0, Math.min(newBottom, maxBottom)) + 'px';
      ball.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        ball.classList.remove('dragging');

        // 保存位置到localStorage
        savePosition(ball);
      }
    });

    // 返回hasMoved检查函数供点击事件使用
    return () => hasMoved;
  }

  /**
   * 保存悬浮球位置
   */
  function savePosition(ball) {
    const rect = ball.getBoundingClientRect();
    const position = {
      left: rect.left,
      bottom: window.innerHeight - rect.bottom
    };
    try {
      localStorage.setItem('zhihu-md-ball-position', JSON.stringify(position));
    } catch (e) {
      Logger.warn('无法保存悬浮球位置:', e);
    }
  }

  /**
   * 恢复悬浮球位置
   */
  function restorePosition(ball) {
    try {
      const saved = localStorage.getItem('zhihu-md-ball-position');
      if (saved) {
        const position = JSON.parse(saved);
        // 确保位置在可视区域内
        const maxLeft = window.innerWidth - ball.offsetWidth;
        const maxBottom = window.innerHeight - ball.offsetHeight;

        ball.style.left = Math.max(0, Math.min(position.left, maxLeft)) + 'px';
        ball.style.bottom = Math.max(0, Math.min(position.bottom, maxBottom)) + 'px';
        ball.style.right = 'auto';
        Logger.debug('恢复悬浮球位置:', position);
      }
    } catch (e) {
      Logger.warn('无法恢复悬浮球位置:', e);
    }
  }

  /**
   * 更新悬浮球状态
   */
  function updateBallState(ball, state, icon = null) {
    ball.classList.remove('loading', 'success', 'error');

    const iconSvg = ball.querySelector('.icon');

    switch (state) {
      case 'loading':
        ball.classList.add('loading');
        iconSvg.innerHTML = `
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="32" stroke-linecap="round"/>
        `;
        break;
      case 'success':
        ball.classList.add('success');
        iconSvg.innerHTML = `
          <path d="M5 12L10 17L20 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        `;
        break;
      case 'error':
        ball.classList.add('error');
        iconSvg.innerHTML = `
          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        `;
        break;
      default:
        iconSvg.innerHTML = `
          <path d="M12 3V15M12 15L7 10M12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
        `;
    }
  }

  /**
   * 处理悬浮球点击导出
   */
  async function handleBallClick(ball, checkHasMoved) {
    // 如果是拖拽结束，不触发点击
    if (checkHasMoved && checkHasMoved()) {
      return;
    }

    Logger.info('悬浮球被点击，开始导出...');

    updateBallState(ball, 'loading');
    ball.querySelector('.tooltip').textContent = '导出中...';

    try {
      // 执行导出
      const result = exportMarkdown();

      if (result.success) {
        Logger.success('Markdown 生成成功，发送下载请求...');

        // 发送下载请求到 background script
        await chrome.runtime.sendMessage({
          action: 'download',
          filename: result.data.filename,
          content: result.data.content
        });

        updateBallState(ball, 'success');
        ball.querySelector('.tooltip').textContent = '导出成功!';

        setTimeout(() => {
          updateBallState(ball, 'normal');
          ball.querySelector('.tooltip').textContent = '导出 Markdown';
        }, 2000);
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      Logger.error('悬浮球导出失败:', error);
      updateBallState(ball, 'error');
      ball.querySelector('.tooltip').textContent = '导出失败';

      setTimeout(() => {
        updateBallState(ball, 'normal');
        ball.querySelector('.tooltip').textContent = '导出 Markdown';
      }, 2000);
    }
  }

  /**
   * 初始化悬浮球
   */
  function initFloatingBall() {
    Logger.info('==========================================');
    Logger.info('初始化悬浮球...');
    Logger.info('==========================================');

    // 检查页面类型
    if (!isValidArticlePage()) {
      Logger.info('非文章页面，不显示悬浮球');
      return;
    }

    // 注入样式
    injectFloatingBallStyles();

    // 创建悬浮球
    const ball = createFloatingBall();

    // 恢复位置
    restorePosition(ball);

    // 初始化拖拽
    const checkHasMoved = initDrag(ball);

    // 绑定点击事件
    ball.addEventListener('click', () => handleBallClick(ball, checkHasMoved));

    Logger.success('悬浮球初始化完成!');
  }

  // 等待DOM加载完成后初始化悬浮球
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingBall);
  } else {
    // 延迟一点执行，确保页面加载完成
    setTimeout(initFloatingBall, 500);
  }

})();
