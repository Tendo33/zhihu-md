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
   * Detect page type (column article, single answer, or question page)
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
    // 支持问题页面（查看全部回答）- 只有 /question/ 没有 /answer/
    if (pathname.includes('/question/') && !pathname.includes('/answer/')) {
      Logger.info('页面类型: 问题页面 (question)');
      return 'question';
    }
    
    Logger.warn('无法识别的页面类型，路径:', pathname);
    return null;
  }

  // ============== 常量定义 ==============
  const CONSTANTS = {
    SELECTORS: {
      COLUMN_CONTAINER: ['.Post-RichText', '.RichText.ztext.Post-RichText'],
      ANSWER_CONTAINER: ['.AnswerItem .RichText', '[data-za-detail-view-id="{id}"]'],
      TITLE: {
        COLUMN: ['.Post-Title', 'h1.Post-Title'],
        ANSWER: ['.QuestionHeader-title']
      },
      AUTHOR: {
        COLUMN: ['.AuthorInfo-name', '.UserLink-link'],
        ANSWER: ['.AnswerItem .AuthorInfo-name', '.AnswerItem .UserLink-link']
      },
      UNWANTED: [
        '.ContentItem-actions',    // Action buttons
        '.RichText-ADLinkCardContainer', // Ad cards
        '.AdblockBanner',          // Adblock banners
        '.Reward',                 // Reward/tip section
        '.Post-topicsAndReviewer', // Topics section
        '.FollowButton',           // Follow buttons
        '.Question-sideColumn',    // Side column
        '.CornerButtons'           // Floating buttons
      ]
    }
  };

  /**
   * Helper to find element by multiple selectors
   */
  function querySelectorAny(parent, selectors) {
    for (const selector of selectors) {
      const el = parent.querySelector(selector);
      if (el) return el;
    }
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
      container = querySelectorAny(document, CONSTANTS.SELECTORS.COLUMN_CONTAINER);
      Logger.debug('专栏容器查找结果:', container ? '找到' : '未找到');
    } else if (pageType === 'answer') {
      Logger.debug('尝试查找问答内容容器...');
      // For answer pages, find the specific answer content
      const answerMatch = window.location.pathname.match(/\/answer\/(\d+)/);
      Logger.debug('回答 ID 匹配结果:', answerMatch);
      
      if (answerMatch) {
        const answerId = answerMatch[1];
        Logger.debug('回答 ID:', answerId);
        // Try specific ID selector first
        const idSelector = `[data-za-detail-view-id="${answerId}"]`;
        const answerElement = document.querySelector(idSelector) ||
          document.querySelector('.AnswerItem');

        Logger.debug('回答元素查找结果:', answerElement ? '找到' : '未找到');
        container = answerElement?.querySelector('.RichText') || answerElement;
      } else {
        container = document.querySelector('.AnswerItem .RichText');
      }
      Logger.debug('.AnswerItem .RichText 查找结果:', container ? '找到' : '未找到');
    } else if (pageType === 'question') {
      // 问题页面（查看全部回答）- 获取第一个展开的回答
      Logger.debug('尝试查找问题页面内容容器...');
      // 首先尝试找到已展开的回答
      const expandedAnswer = document.querySelector('.AnswerItem .RichText.ztext');
      if (expandedAnswer) {
        container = expandedAnswer;
        Logger.debug('找到已展开的回答');
      } else {
        // 否则尝试找第一个回答
        container = document.querySelector('.AnswerItem .RichText');
        Logger.debug('尝试找第一个回答:', container ? '找到' : '未找到');
      }
    }
    
    if (container) {
      Logger.success('内容容器找到!');
      Logger.debug('容器元素:', container.tagName, container.className);
      Logger.debug('容器 HTML 长度:', container.innerHTML?.length || 0, '字符');
    } else {
      Logger.error('未找到内容容器!');
      Logger.debug('当前页面所有 class:');
      try {
        Logger.debug(Array.from(document.querySelectorAll('*')).map(el => el.className).filter(c => c).slice(0, 50));
      } catch (e) { }
    }
    
    Logger.groupEnd();
    return container;
  }

  /**
   * Get article title
   */
  function getTitle(pageType) {
    if (pageType === 'column') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.TITLE.COLUMN)?.textContent?.trim();
    } else if (pageType === 'answer' || pageType === 'question') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.TITLE.ANSWER)?.textContent?.trim();
    }
    return document.title;
  }

  /**
   * Get author name
   */
  function getAuthor(pageType) {
    if (pageType === 'column') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.AUTHOR.COLUMN)?.textContent?.trim();
    } else if (pageType === 'answer' || pageType === 'question') {
      const answerItem = document.querySelector('.AnswerItem');
      if (answerItem) {
        return querySelectorAny(answerItem, ['.AuthorInfo-name', '.UserLink-link'])?.textContent?.trim();
      }
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
  function generateFrontMatter(title, author, url, createdTime = '', editedTime = '') {
    const date = new Date().toISOString().split('T')[0];
    let frontMatter = `---
title: "${title.replace(/"/g, '\\"')}"
url: ${url}
author: ${author || '未知'}
date: ${date}`;

    if (createdTime) {
      frontMatter += `\ncreated: ${createdTime}`;
    }
    if (editedTime) {
      frontMatter += `\nedited: ${editedTime}`;
    }

    frontMatter += `\n---

`;
    return frontMatter;
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
    
    // 提取时间信息
    let createdTime = '';
    let editedTime = '';

    // 对于专栏文章，查找 Post-Header 中的时间
    if (pageType === 'column') {
      const timeEl = document.querySelector('.Post-Header .ContentItem-time');
      if (timeEl) {
        const timeText = timeEl.textContent || '';
        const createdMatch = timeText.match(/发布于\s*([^\s编]+)/);
        const editedMatch = timeText.match(/编辑于\s*(.+)/);
        if (createdMatch) createdTime = createdMatch[1].trim();
        if (editedMatch) editedTime = editedMatch[1].trim();
      }
    } else if (pageType === 'answer') {
      // 对于单个回答页面
      const answerItem = document.querySelector('.AnswerItem');
      if (answerItem) {
        const timeEl = answerItem.querySelector('.ContentItem-time');
        if (timeEl) {
          const timeText = timeEl.textContent || '';
          const createdMatch = timeText.match(/发布于\s*([^\s编]+)/);
          const editedMatch = timeText.match(/编辑于\s*(.+)/);
          if (createdMatch) createdTime = createdMatch[1].trim();
          if (editedMatch) editedTime = editedMatch[1].trim();
        }
      }
    }

    Logger.debug('标题:', title);
    Logger.debug('作者:', author);
    Logger.debug('创建时间:', createdTime);
    Logger.debug('编辑时间:', editedTime);

    if (!container) {
      Logger.error('内容容器未找到');
      return { success: false, error: '无法找到文章内容' };
    }

    try {
      Logger.debug('克隆容器节点...');
      // Clone the container to avoid modifying the original DOM
      const clonedContainer = container.cloneNode(true);
      
      // Pre-process: Remove unwanted elements
      Logger.debug('移除不需要的元素...');
      CONSTANTS.SELECTORS.UNWANTED.forEach(selector => {
        const removed = clonedContainer.querySelectorAll(selector);
        if (removed.length > 0) {
          Logger.debug(`移除 ${selector}:`, removed.length, '个');
          removed.forEach(el => el.remove());
        }
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

      // Add front matter with time info
      Logger.debug('添加 front matter...');
      const frontMatter = generateFrontMatter(title, author, window.location.href, createdTime, editedTime);
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

  /**
   * Process a single answer element and extract content
   */
  function processAnswerContent(answerItem, turndownService) {
    // Get author info
    const authorEl = answerItem.querySelector('.AuthorInfo-name') ||
      answerItem.querySelector('.UserLink-link');
    const author = authorEl?.textContent?.trim() || '匿名用户';

    // Get time info - 知乎时间通常在 ContentItem-time 或 meta 区域
    let createdTime = '';
    let editedTime = '';

    // 尝试查找时间信息
    const timeEl = answerItem.querySelector('.ContentItem-time');
    if (timeEl) {
      const timeText = timeEl.textContent || '';
      // 解析 "发布于 xxx" 或 "编辑于 xxx"
      const createdMatch = timeText.match(/发布于\s*([^\s编]+)/);
      const editedMatch = timeText.match(/编辑于\s*(.+)/);
      if (createdMatch) createdTime = createdMatch[1].trim();
      if (editedMatch) editedTime = editedMatch[1].trim();
    }

    // 如果没找到，尝试其他选择器
    if (!createdTime) {
      const metaEl = answerItem.querySelector('[data-za-detail-view-name="AnswerItem"] .ContentItem-meta');
      if (metaEl) {
        const spans = metaEl.querySelectorAll('span');
        spans.forEach(span => {
          const text = span.textContent || '';
          if (text.includes('发布于') || text.includes('创建于')) {
            createdTime = text.replace(/发布于|创建于/g, '').trim();
          }
          if (text.includes('编辑于')) {
            editedTime = text.replace('编辑于', '').trim();
          }
        });
      }
    }

    // Get answer content
    const contentEl = answerItem.querySelector('.RichText.ztext');
    if (!contentEl) return null;

    // Clone and clean
    const clonedContent = contentEl.cloneNode(true);

    // Remove unwanted elements
    CONSTANTS.SELECTORS.UNWANTED.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove noscript
    clonedContent.querySelectorAll('noscript').forEach(el => el.remove());

    // Convert to markdown
    const markdown = turndownService.turndown(clonedContent);

    return {
      author,
      createdTime,
      editedTime,
      content: markdown
    };
  }

  /**
   * Scroll page to load more answers
   */
  async function scrollToLoadAnswers(targetCount) {
    Logger.info(`尝试加载 ${targetCount} 个回答...`);

    const startTime = Date.now();
    const maxTime = 30000; // 30 seconds timeout
    let lastCount = 0;
    let noChangeCount = 0;

    while (Date.now() - startTime < maxTime) {
      const currentAnswers = document.querySelectorAll('.AnswerItem');
      const currentCount = currentAnswers.length;

      Logger.debug(`当前已加载 ${currentCount} 个回答`);

      if (currentCount >= targetCount) {
        Logger.success(`已加载足够数量的回答: ${currentCount}`);
        return currentCount;
      }

      // Check if page stopped loading new answers
      if (currentCount === lastCount) {
        noChangeCount++;
        if (noChangeCount >= 3) {
          Logger.warn(`页面似乎没有更多回答了，当前数量: ${currentCount}`);
          return currentCount;
        }
      } else {
        noChangeCount = 0;
      }
      lastCount = currentCount;

      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    Logger.warn('滚动加载超时');
    return document.querySelectorAll('.AnswerItem').length;
  }

  /**
   * Export multiple answers from question page
   */
  async function exportMultipleAnswers() {
    Logger.info('==========================================');
    Logger.info('开始导出多个回答...');
    Logger.info('==========================================');

    const pageType = detectPageType();
    if (pageType !== 'question') {
      Logger.warn('非问题页面，使用单回答导出');
      return exportMarkdown();
    }

    try {
      // Get user settings
      let maxAnswerCount = 20;
      try {
        const settings = await new Promise(resolve => {
          chrome.storage.sync.get({ maxAnswerCount: 20 }, resolve);
        });
        maxAnswerCount = settings.maxAnswerCount;
      } catch (e) {
        Logger.warn('无法读取设置，使用默认值 20');
      }

      Logger.info(`目标下载回答数量: ${maxAnswerCount}`);

      // Scroll to load answers
      const loadedCount = await scrollToLoadAnswers(maxAnswerCount);
      Logger.info(`实际加载回答数量: ${loadedCount}`);

      // Get all answer items
      const answerItems = document.querySelectorAll('.AnswerItem');
      const answersToProcess = Array.from(answerItems).slice(0, maxAnswerCount);

      if (answersToProcess.length === 0) {
        return { success: false, error: '未找到任何回答' };
      }

      // Get question info
      const title = getTitle('question') || '未知问题';
      const date = new Date().toISOString().split('T')[0];

      // Create turndown service
      const turndownService = createTurndownService();

      // Process each answer
      const processedAnswers = [];
      for (let i = 0; i < answersToProcess.length; i++) {
        const answer = processAnswerContent(answersToProcess[i], turndownService);
        if (answer) {
          processedAnswers.push(answer);
          Logger.debug(`处理回答 ${i + 1}/${answersToProcess.length}: ${answer.author}`);
        }
      }

      if (processedAnswers.length === 0) {
        return { success: false, error: '无法解析回答内容' };
      }

      // Build markdown content
      let markdown = `---
title: "${title.replace(/"/g, '\\"')}"
url: ${window.location.href}
date: ${date}
answer_count: ${processedAnswers.length}
---

# ${title}

`;

      processedAnswers.forEach((answer, index) => {
        markdown += `---

## 回答 ${index + 1}

**作者**: ${answer.author}`;

        if (answer.createdTime) {
          markdown += `  
**创建于**: ${answer.createdTime}`;
        }
        if (answer.editedTime) {
          markdown += `  
**编辑于**: ${answer.editedTime}`;
        }

        markdown += `

${answer.content}

`;
      });

      // Clean up extra newlines
      markdown = markdown.replace(/\n{3,}/g, '\n\n');

      // Generate filename
      const filename = cleanFilename(title) + '_多回答.md';

      Logger.success(`导出成功! 共 ${processedAnswers.length} 个回答`);

      return {
        success: true,
        data: {
          content: markdown,
          filename: filename
        }
      };
    } catch (error) {
      Logger.error('多回答导出失败:', error);
      return { success: false, error: '导出失败: ' + error.message };
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

    // 检测页面类型，显示不同的提示
    const pageType = detectPageType();
    if (pageType === 'question') {
      ball.querySelector('.tooltip').textContent = '加载回答中...';
    } else {
      ball.querySelector('.tooltip').textContent = '导出中...';
    }

    try {
      // 根据页面类型选择导出方法
      let result;
      if (pageType === 'question') {
        result = await exportMultipleAnswers();
      } else {
        result = exportMarkdown();
      }

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
      removeFloatingBall();
      return;
    }

    // Check user preference
    // 确保 chrome.storage 存在后再调用
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ showFloatingBall: true }, (items) => {
        if (!items.showFloatingBall) {
          Logger.info('用户禁用悬浮球，不显示');
          removeFloatingBall();
          return;
        }

        // 创建悬浮球 (如果已存在则直接返回)
        const ball = createFloatingBall();

        // ... rest of init logic only if enabled ...
        // 恢复位置
        restorePosition(ball);

        // 初始化拖拽
        const checkHasMoved = initDrag(ball);

        // 绑定点击事件 (先移除旧的监听器以防重复绑定)
        const newBall = ball.cloneNode(true);
        if (ball.parentNode) {
          ball.parentNode.replaceChild(newBall, ball);
          newBall.addEventListener('click', () => handleBallClick(newBall, initDrag(newBall)));
        }

        Logger.success('悬浮球初始化/更新完成!');
      });
    } else {
      Logger.warn('chrome.storage 不可用，使用默认设置 (显示悬浮球)');
      // 如果 storage API 不可用，默认显示悬浮球
      const ball = createFloatingBall();
      restorePosition(ball);
      const checkHasMoved = initDrag(ball);
      const newBall = ball.cloneNode(true);
      if (ball.parentNode) {
        ball.parentNode.replaceChild(newBall, ball);
        newBall.addEventListener('click', () => handleBallClick(newBall, initDrag(newBall)));
      }
      Logger.success('悬浮球初始化完成 (默认模式)!');
    }
  }

  // Listen for storage changes
  // 添加防御性检查
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.showFloatingBall) {
        if (changes.showFloatingBall.newValue) {
          initFloatingBall();
        } else {
          removeFloatingBall();
        }
      }
    });
  } else {
    Logger.warn('chrome.storage.onChanged 不可用，无法监听设置变化');
  }

  /**
   * 移除悬浮球
   */
  function removeFloatingBall() {
    const ball = document.getElementById('zhihu-md-floating-ball');
    if (ball) {
      ball.remove();
      Logger.info('悬浮球已移除');
    }
  }

  // Handle SPA navigation
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'routeChanged') {
      Logger.info('路由改变，重新检查悬浮球状态...', message.url);
      // Give DOM a moment to update
      setTimeout(initFloatingBall, 1000);
    }
  });

  // Observe DOM changes to handle dynamic content loading
  // Some Zhihu pages load content asynchronously
  const observer = new MutationObserver((mutations) => {
    // Check if we are on a valid page but ball is missing
    if (isValidArticlePage() && !document.getElementById('zhihu-md-floating-ball')) {
      // Debounce initialization
      if (window._initTimeout) clearTimeout(window._initTimeout);
      window._initTimeout = setTimeout(initFloatingBall, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 等待DOM加载完成后初始化悬浮球
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingBall);
  } else {
    // 延迟一点执行，确保页面加载完成
    setTimeout(initFloatingBall, 500);
  }

})();
