/**
 * Content script for Zhihu-md extension
 * Parses Zhihu article DOM and converts to Markdown
 */

(function() {
  'use strict';

  // ============== 日志系统 ==============
  const Logger = createLogger('[Zhihu-MD Content]');

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
   * Detect page type (column article, single answer, question page, home, follow, or hot)
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
    // 热榜页面
    if (pathname === '/hot' || pathname === '/hot/') {
      Logger.info('页面类型: 热榜页面 (hot)');
      return 'hot';
    }
    // 关注页面
    if (pathname === '/follow' || pathname === '/follow/') {
      Logger.info('页面类型: 关注页面 (follow)');
      return 'follow';
    }
    // 首页
    if (pathname === '/' || pathname === '') {
      Logger.info('页面类型: 首页 (home)');
      return 'home';
    }
    
    Logger.debug('非文章页面，路径:', pathname);
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

    // 对于首页、关注页和热榜，不需要检查内容容器
    if (pageType === 'home' || pageType === 'follow' || pageType === 'hot') {
      let title, author;
      if (pageType === 'home') {
        title = '知乎首页推荐';
        author = '知乎';
      } else if (pageType === 'follow') {
        title = '知乎关注动态';
        author = '知乎';
      } else {
        title = '知乎热榜';
        author = '知乎';
      }

      const result = {
        success: true,
        data: {
          title: title,
          author: author,
          type: pageType
        }
      };

      Logger.success('页面信息获取成功:', result);
      return result;
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

  // ============== 热榜页导出功能 ==============

  /**
   * Export hot list items from /hot page
   * Only exports question titles and links
   */
  async function exportHotList() {
    Logger.info('==========================================');
    Logger.info('开始导出热榜...');
    Logger.info('==========================================');

    try {
      // 热榜页面可能需要等待加载
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 查找热榜容器 - 知乎热榜的选择器
      const hotItems = document.querySelectorAll('.HotList-item, .HotItem, [class*="HotItem"]');

      if (hotItems.length === 0) {
        // 备选选择器
        const altItems = document.querySelectorAll('.HotList .HotItem-content, .css-1xgfyz0');
        if (altItems.length === 0) {
          Logger.error('未找到热榜条目');
          return { success: false, error: '未找到热榜内容，请确保在热榜页面' };
        }
      }

      const items = [];

      // 遍历所有热榜条目
      const hotListItems = document.querySelectorAll('.HotList-item, .HotItem, [class*="HotItem-content"]');

      hotListItems.forEach((item, index) => {
        // 查找标题链接
        const titleEl = item.querySelector('.HotItem-title, [class*="HotItem-title"], a[href*="/question/"]');
        const linkEl = item.querySelector('a[href*="/question/"]') || item.querySelector('a');

        // 获取热度/排名
        const rankEl = item.querySelector('.HotItem-rank, .HotItem-index, [class*="index"]');
        const metricsEl = item.querySelector('.HotItem-metrics, [class*="metrics"]');

        if (titleEl || linkEl) {
          const title = titleEl?.textContent?.trim() || linkEl?.textContent?.trim() || '未知标题';
          const href = linkEl?.getAttribute('href') || '';
          const fullUrl = href.startsWith('http') ? href : `https://www.zhihu.com${href}`;
          const rank = rankEl?.textContent?.trim() || String(index + 1);
          const metrics = metricsEl?.textContent?.trim() || '';

          items.push({
            rank,
            title,
            url: fullUrl,
            metrics
          });
        }
      });

      // 如果上面的选择器没找到，尝试更通用的方法
      if (items.length === 0) {
        Logger.debug('使用备选方法查找热榜...');
        const allLinks = document.querySelectorAll('a[href*="/question/"]');
        const seenUrls = new Set();

        allLinks.forEach((link, index) => {
          const href = link.getAttribute('href');
          if (href && !seenUrls.has(href)) {
            seenUrls.add(href);
            const title = link.textContent?.trim() || '未知标题';
            if (title && title.length > 5) { // 过滤掉太短的文本
              items.push({
                rank: String(items.length + 1),
                title,
                url: href.startsWith('http') ? href : `https://www.zhihu.com${href}`,
                metrics: ''
              });
            }
          }
        });
      }

      if (items.length === 0) {
        return { success: false, error: '未能提取热榜条目' };
      }

      Logger.info(`找到 ${items.length} 个热榜条目`);

      // 构建 Markdown
      const date = new Date().toISOString().split('T')[0];
      let markdown = `---
title: "知乎热榜"
url: ${window.location.href}
date: ${date}
count: ${items.length}
---

# 知乎热榜

`;

      items.forEach(item => {
        markdown += `${item.rank}. [${item.title}](${item.url})`;
        if (item.metrics) {
          markdown += ` - ${item.metrics}`;
        }
        markdown += '\n';
      });

      const filename = `知乎热榜_${date}.md`;

      Logger.success(`热榜导出成功! 共 ${items.length} 条`);

      return {
        success: true,
        data: {
          content: markdown,
          filename: filename
        }
      };
    } catch (error) {
      Logger.error('热榜导出失败:', error);
      return { success: false, error: '导出失败: ' + error.message };
    }
  }

  // ============== 首页/关注页 Feed 导出功能 ==============

  /**
   * Scroll to load more feed items
   */
  async function scrollToLoadFeedItems(targetCount) {
    Logger.info(`尝试加载 ${targetCount} 个 Feed 条目...`);

    const startTime = Date.now();
    const maxTime = 30000; // 30 seconds timeout
    let lastCount = 0;
    let noChangeCount = 0;

    while (Date.now() - startTime < maxTime) {
      // 统计当前加载的 Feed 条目
      const currentItems = document.querySelectorAll('.Feed, .TopstoryItem, [class*="FeedItem"], .ContentItem');
      const currentCount = currentItems.length;

      Logger.debug(`当前已加载 ${currentCount} 个 Feed 条目`);

      if (currentCount >= targetCount) {
        Logger.success(`已加载足够数量的条目: ${currentCount}`);
        return currentCount;
      }

      // Check if page stopped loading new items
      if (currentCount === lastCount) {
        noChangeCount++;
        if (noChangeCount >= 3) {
          Logger.warn(`页面似乎没有更多内容了，当前数量: ${currentCount}`);
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
    return document.querySelectorAll('.Feed, .TopstoryItem, [class*="FeedItem"], .ContentItem').length;
  }

  /**
   * Process a single feed item and extract content
   * Expands content before extracting to get full text
   */
  async function processFeedItem(feedItem, turndownService) {
    // 查找内容类型和标题
    const titleEl = feedItem.querySelector('.ContentItem-title a, [class*="ContentItem-title"] a, h2 a');
    const authorEl = feedItem.querySelector('.AuthorInfo-name, .UserLink-link, [class*="AuthorInfo"] a');

    // 获取时间信息
    const timeEl = feedItem.querySelector('.ContentItem-time, [class*="ContentItem-time"]');

    // 获取链接
    const linkEl = feedItem.querySelector('a[href*="/question/"], a[href*="/p/"], h2 a');

    if (!titleEl) {
      return null;
    }

    const title = titleEl?.textContent?.trim() || '无标题';
    const author = authorEl?.textContent?.trim() || '未知作者';
    const href = linkEl?.getAttribute('href') || '';
    const fullUrl = href.startsWith('http') ? href : `https://www.zhihu.com${href}`;
    const timeText = timeEl?.textContent?.trim() || '';

    // 尝试展开内容（点击"展开阅读全文"按钮）
    // 注意：不能使用 :contains() 选择器，它不是标准 CSS
    const expandButton = feedItem.querySelector(
      'button.ContentItem-more, ' +
      'button[class*="ContentItem-more"], ' +
      '.ContentItem-expandButton, ' +
      '[class*="ContentItem"] button[class*="expand"], ' +
      '.RichContent-inner button, ' +
      '.Button--plain'
    );

    // 备选：查找包含"阅读全文"文本的按钮
    let expandBtn = expandButton;
    if (!expandBtn) {
      const buttons = feedItem.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('阅读全文') || btn.textContent.includes('展开')) {
          expandBtn = btn;
          break;
        }
      }
    }

    if (expandBtn) {
      try {
        Logger.debug(`点击展开按钮: ${title.substring(0, 20)}...`);
        expandBtn.click();
        // 等待内容加载
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        Logger.debug('展开按钮点击失败:', e);
      }
    }

    // 获取内容（展开后）
    const contentEl = feedItem.querySelector('.RichText, .RichContent-inner, [class*="RichText"]');

    // 转换内容为 Markdown
    let contentMd = '';
    if (contentEl) {
      const clonedContent = contentEl.cloneNode(true);
      // 移除不需要的元素
      clonedContent.querySelectorAll('.ContentItem-actions, noscript, .RichText-ADLinkCardContainer, button').forEach(el => el.remove());
      contentMd = turndownService.turndown(clonedContent);
    }

    return {
      title,
      author,
      url: fullUrl,
      time: timeText,
      content: contentMd
    };
  }

  /**
   * Export feed items from home or follow page
   */
  async function exportFeedItems(pageType) {
    Logger.info('==========================================');
    Logger.info(`开始导出${pageType === 'home' ? '首页' : '关注页'} Feed...`);
    Logger.info('==========================================');

    try {
      // Get user settings for max items
      let maxItemCount = 20;
      try {
        const settings = await new Promise(resolve => {
          chrome.storage.sync.get({ maxAnswerCount: 20 }, resolve);
        });
        maxItemCount = settings.maxAnswerCount;
      } catch (e) {
        Logger.warn('无法读取设置，使用默认值 20');
      }

      Logger.info(`目标下载条目数量: ${maxItemCount}`);

      // Scroll to load items
      const loadedCount = await scrollToLoadFeedItems(maxItemCount);
      Logger.info(`实际加载条目数量: ${loadedCount}`);

      // Get all feed items
      const feedItems = document.querySelectorAll('.Feed, .TopstoryItem, [class*="FeedItem"], .ContentItem');
      const itemsToProcess = Array.from(feedItems).slice(0, maxItemCount);

      if (itemsToProcess.length === 0) {
        return { success: false, error: '未找到任何内容' };
      }

      // Create turndown service
      const turndownService = createTurndownService();

      // Process each item (with expansion)
      Logger.info('正在展开并处理每个条目的内容...');
      const processedItems = [];
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = await processFeedItem(itemsToProcess[i], turndownService);
        if (item) {
          processedItems.push(item);
          Logger.debug(`处理条目 ${i + 1}/${itemsToProcess.length}: ${item.title.substring(0, 30)}...`);
        }
      }

      if (processedItems.length === 0) {
        return { success: false, error: '无法解析内容' };
      }

      // Build markdown content
      const date = new Date().toISOString().split('T')[0];
      const pageTitle = pageType === 'home' ? '知乎首页推荐' : '知乎关注动态';

      let markdown = `---
title: "${pageTitle}"
url: ${window.location.href}
date: ${date}
item_count: ${processedItems.length}
---

# ${pageTitle}

`;

      processedItems.forEach((item, index) => {
        markdown += `---

## ${index + 1}. ${item.title}

**作者**: ${item.author}`;

        if (item.time) {
          markdown += `  
**时间**: ${item.time}`;
        }

        markdown += `  
**链接**: [查看原文](${item.url})

${item.content}

`;
      });

      // Clean up extra newlines
      markdown = markdown.replace(/\n{3,}/g, '\n\n');

      // Generate filename
      const filename = `${pageTitle}_${date}.md`;

      Logger.success(`导出成功! 共 ${processedItems.length} 条内容`);

      return {
        success: true,
        data: {
          content: markdown,
          filename: filename
        }
      };
    } catch (error) {
      Logger.error('Feed 导出失败:', error);
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
    // Clean, minimal SVG
    ball.innerHTML = `
      <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="tooltip">导出 Markdown</span>
    `;

    document.body.appendChild(ball);
    Logger.success('悬浮球DOM创建成功');
    return ball;
  }

  /**
   * 初始化拖拽功能
   */
  function initDrag(ball) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let hasMoved = false;
    let dockTimeout;

    // 清除 docked 状态的辅助函数
    const clearDockedState = () => {
      ball.classList.remove('docked-left', 'docked-right');
      if (dockTimeout) {
        clearTimeout(dockTimeout);
        dockTimeout = null;
      }
    };

    // 检查是否发生过移动，用于区分点击和拖拽
    const checkHasMoved = () => hasMoved;

    const onMouseDown = (e) => {
      // 排除右键
      if (e.button !== 0) return;

      isDragging = true;
      hasMoved = false;
      ball.classList.add('dragging');
      clearDockedState();

      // 获取当前位置 (计算后的样式)
      const rect = ball.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      // 切换到 fixed定位 + left/top 模式，避免 right/bottom 干扰
      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
      ball.style.left = `${initialLeft}px`;
      ball.style.top = `${initialTop}px`;

      // 阻止文本选择
      e.preventDefault();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // 只有移动超过一定阈值才算作拖动
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      // 边界检查，防止拖出屏幕
      const maxLeft = window.innerWidth - ball.offsetWidth;
      const maxTop = window.innerHeight - ball.offsetHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      ball.style.left = `${newLeft}px`;
      ball.style.top = `${newTop}px`;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      ball.classList.remove('dragging');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (hasMoved) {
        // 拖拽结束，检查是否需要吸附边缘
        handleSnapAndDock();
      }
    };

    // 触摸事件支持
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;

      isDragging = true;
      hasMoved = false;
      ball.classList.add('dragging');
      clearDockedState();

      const touch = e.touches[0];
      const rect = ball.getBoundingClientRect();
      startX = touch.clientX;
      startY = touch.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
      ball.style.left = `${initialLeft}px`;
      ball.style.top = `${initialTop}px`;

      e.preventDefault(); // 防止滚动
    };

    const onTouchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = window.innerWidth - ball.offsetWidth;
      const maxTop = window.innerHeight - ball.offsetHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      ball.style.left = `${newLeft}px`;
      ball.style.top = `${newTop}px`;
    };

    const onTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      ball.classList.remove('dragging');
      if (hasMoved) {
        handleSnapAndDock();
      }
    };

    // 处理吸附和隐藏
    const handleSnapAndDock = () => {
      const rect = ball.getBoundingClientRect();
      const winWidth = window.innerWidth;

      // 保存位置
      savePosition(rect.left, rect.top);

      // 如果靠近边缘 (比如 30px 内)，则吸附
      const docThreshold = 30;
      let dockedSide = null;

      // 靠近左边
      if (rect.left < docThreshold) {
        ball.style.left = '0px';
        savePosition(0, rect.top);
        dockedSide = 'left';
      }
      // 靠近右边
      else if (winWidth - rect.right < docThreshold) {
        ball.style.left = `${winWidth - rect.width}px`; // Right align
        savePosition(winWidth - rect.width, rect.top);
        dockedSide = 'right';
      }

      if (dockedSide) {
        // 延迟进入 docked 状态
        dockTimeout = setTimeout(() => {
          ball.classList.add(`docked-${dockedSide}`);
        }, 800);
      }
    };

    // 鼠标进入时清除 docked 状态
    ball.addEventListener('mouseenter', clearDockedState);

    // 鼠标离开时，如果靠边，重新进入 docked 状态
    ball.addEventListener('mouseleave', () => {
      if (!isDragging) {
        const rect = ball.getBoundingClientRect();
        const winWidth = window.innerWidth;
        // 判断是否贴着左右边缘
        if (rect.left <= 5) {
          dockTimeout = setTimeout(() => {
            ball.classList.add('docked-left');
          }, 800);
        } else if (rect.right >= winWidth - 5) {
          dockTimeout = setTimeout(() => {
            ball.classList.add('docked-right');
          }, 800);
        }
      }
    });

    ball.addEventListener('mousedown', onMouseDown);
    ball.addEventListener('touchstart', onTouchStart, { passive: false });
    ball.addEventListener('touchmove', onTouchMove, { passive: false });
    ball.addEventListener('touchend', onTouchEnd);

    return checkHasMoved;
  }

  /**
   * 保存悬浮球位置
   */
  function savePosition(x, y) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // 使用 local storage 存储特定设备的位置偏好
      chrome.storage.local.set({
        floatingBallPosition: { x, y }
      });
    }
  }

  /**
   * 恢复悬浮球位置
   */
  function restorePosition(ball) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['floatingBallPosition'], (result) => {
        if (result.floatingBallPosition) {
          const { x, y } = result.floatingBallPosition;

          // 简单的边界检查，防止恢复到屏幕外
          const maxLeft = window.innerWidth - 40;
          const maxTop = window.innerHeight - 40;

          let validX = Math.max(0, Math.min(x, maxLeft));
          let validY = Math.max(0, Math.min(y, maxTop));

          ball.style.right = 'auto';
          ball.style.bottom = 'auto';
          ball.style.left = `${validX}px`;
          ball.style.top = `${validY}px`;

          // 如果恢复的位置在边缘，应用 docked 状态
          if (validX <= 5) {
            setTimeout(() => ball.classList.add('docked-left'), 800);
          } else if (validX >= window.innerWidth - 45) {
            setTimeout(() => ball.classList.add('docked-right'), 800);
          }
        }
      });
    }
  }

  /**
   * 更新悬浮球状态
   */
  function updateBallState(ball, state, icon = null) {
    ball.classList.remove('loading', 'success', 'error');

    const iconSvg = ball.querySelector('.icon');
    // Helper to keep SVG attributes consistent
    const svgAttrs = 'width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

    switch (state) {
      case 'loading':
        ball.classList.add('loading');
        iconSvg.innerHTML = `
          <g stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </g>
        `;
        break;
      case 'success':
        ball.classList.add('success');
        iconSvg.innerHTML = `
          <polyline points="20 6 9 17 4 12"></polyline>
        `;
        break;
      case 'error':
        ball.classList.add('error');
        iconSvg.innerHTML = `
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        `;
        break;
      default:
        // Default download icon
        iconSvg.innerHTML = `
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
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
    if (pageType === 'question' || pageType === 'home' || pageType === 'follow') {
      ball.querySelector('.tooltip').textContent = '加载内容中...';
    } else if (pageType === 'hot') {
      ball.querySelector('.tooltip').textContent = '导出热榜...';
    } else {
      ball.querySelector('.tooltip').textContent = '导出中...';
    }

    try {
      // 根据页面类型选择导出方法
      let result;
      if (pageType === 'question') {
        result = await exportMultipleAnswers();
      } else if (pageType === 'home' || pageType === 'follow') {
        result = await exportFeedItems(pageType);
      } else if (pageType === 'hot') {
        result = await exportHotList();
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

        setupBallElement();
      });
    } else {
      Logger.warn('chrome.storage 不可用，使用默认设置 (显示悬浮球)');
      setupBallElement();
    }
  }

  /**
   * 设置悬浮球元素 (DOM 操作和事件绑定)
   */
  function setupBallElement() {
    // 1. 获取或创建原始元素 (确保都在 DOM 中)
    const existingBall = createFloatingBall();

    // 2. 恢复位置 (在替换前恢复，或者在替换后恢复也可以，位置是样式)
    restorePosition(existingBall);

    // 3. 克隆节点以移除所有旧的事件监听器 (Clean slate)
    const newBall = existingBall.cloneNode(true);

    // 4. 初始化拖拽逻辑 (绑定到 newBall)
    // initDrag 会立即给 newBall 添加 mousedown 等监听器，并返回检查函数
    const checkHasMoved = initDrag(newBall);

    // 5. 绑定点击事件 (使用该 newBall 的拖拽状态检查器)
    newBall.addEventListener('click', (e) => {
      // 阻止事件冒泡，防止触发其他页面元素的点击
      e.stopPropagation();
      handleBallClick(newBall, checkHasMoved);
    });

    // 6. 替换 DOM 中的元素
    if (existingBall.parentNode) {
      existingBall.parentNode.replaceChild(newBall, existingBall);
    } else {
      document.body.appendChild(newBall);
    }

    Logger.success('悬浮球初始化/更新完成!');
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
