/**
 * Article Exporter Module
 * Handles export for single column articles and answers
 */

const ArticleExporter = {
  /**
   * Get article content container based on page type
   * @param {string} pageType 
   * @returns {Element|null}
   */
  getContentContainer(pageType) {
    if (pageType === 'column') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.COLUMN_CONTAINER);
    } else if (pageType === 'answer') {
      const answerMatch = window.location.pathname.match(/\/answer\/(\d+)/);
      
      if (answerMatch) {
        const answerId = answerMatch[1];
        const idSelector = `[data-za-detail-view-id="${answerId}"]`;
        const answerElement = document.querySelector(idSelector) ||
          document.querySelector('.AnswerItem');
        return answerElement?.querySelector('.RichText') || answerElement;
      } else {
        return document.querySelector('.AnswerItem .RichText');
      }
    } else if (pageType === 'question') {
      const expandedAnswer = document.querySelector('.AnswerItem .RichText.ztext');
      if (expandedAnswer) {
        return expandedAnswer;
      }
      return document.querySelector('.AnswerItem .RichText');
    }
    
    return null;
  },

  /**
   * Get article title
   * @param {string} pageType 
   * @returns {string}
   */
  getTitle(pageType) {
    if (pageType === 'column') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.TITLE.COLUMN)?.textContent?.trim();
    } else if (pageType === 'answer' || pageType === 'question') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.TITLE.ANSWER)?.textContent?.trim();
    }
    return document.title;
  },

  /**
   * Get author name
   * @param {string} pageType 
   * @returns {string|null}
   */
  getAuthor(pageType) {
    if (pageType === 'column') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.AUTHOR.COLUMN)?.textContent?.trim();
    } else if (pageType === 'answer' || pageType === 'question') {
      const answerItem = document.querySelector('.AnswerItem');
      if (answerItem) {
        return querySelectorAny(answerItem, ['.AuthorInfo-name', '.UserLink-link'])?.textContent?.trim();
      }
    }
    return null;
  },

  /**
   * Extract time info from page
   * @param {string} pageType 
   * @returns {{createdTime: string, editedTime: string}}
   */
  getTimeInfo(pageType) {
    let createdTime = '';
    let editedTime = '';

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

    return { createdTime, editedTime };
  },

  /**
   * Generate YAML front matter
   * @param {string} title 
   * @param {string} author 
   * @param {string} url 
   * @param {string} createdTime 
   * @param {string} editedTime 
   * @returns {string}
   */
  generateFrontMatter(title, author, url, createdTime = '', editedTime = '') {
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

    frontMatter += `\n---\n\n`;
    return frontMatter;
  },

  /**
   * Pre-process container: remove unwanted elements and duplicates
   * @param {Element} container 
   * @returns {Element}
   */
  preprocessContainer(container) {
    const clonedContainer = container.cloneNode(true);
    
    // Remove unwanted elements
    CONSTANTS.SELECTORS.UNWANTED.forEach(selector => {
      clonedContainer.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove noscript tags
    clonedContainer.querySelectorAll('noscript').forEach(el => el.remove());

    // Remove duplicate images
    const seenImageSources = new Set();
    const allImages = clonedContainer.querySelectorAll('img');
    
    allImages.forEach(img => {
      const src = img.getAttribute('data-original') ||
                  img.getAttribute('data-actualsrc') ||
                  img.getAttribute('data-src') ||
                  img.getAttribute('src') || '';
      
      const baseUrl = src.replace(/_\d+w\./, '.').replace(/_[a-z]+\./, '.').split('?')[0];
      
      if (seenImageSources.has(baseUrl)) {
        img.remove();
      } else {
        seenImageSources.add(baseUrl);
      }
    });

    return clonedContainer;
  },

  /**
   * Get article info (for popup display)
   * @returns {Object}
   */
  getArticleInfo() {
    const pageType = PageDetector.detectPageType();
    if (!pageType) {
      return { success: false, error: '不是有效的知乎文章页面' };
    }

    // For home, follow, hot pages
    if (pageType === 'home' || pageType === 'follow' || pageType === 'hot') {
      const titles = {
        home: '知乎首页推荐',
        follow: '知乎关注动态',
        hot: '知乎热榜'
      };

      return {
        success: true,
        data: {
          title: titles[pageType],
          author: '知乎',
          type: pageType
        }
      };
    }

    const title = this.getTitle(pageType);
    const author = this.getAuthor(pageType);
    const container = this.getContentContainer(pageType);

    if (!container) {
      return { success: false, error: '无法找到文章内容' };
    }

    return {
      success: true,
      data: {
        title: title || '未知标题',
        author: author || '未知作者',
        type: pageType
      }
    };
  },

  /**
   * Export article as Markdown
   * @param {boolean} downloadImages - Whether to download images locally
   * @returns {Object}
   */
  async exportMarkdown(downloadImages = false) {
    const pageType = PageDetector.detectPageType();
    if (!pageType) {
      return { success: false, error: '不是有效的知乎文章页面' };
    }

    const title = this.getTitle(pageType);
    const author = this.getAuthor(pageType);
    const container = this.getContentContainer(pageType);
    const { createdTime, editedTime } = this.getTimeInfo(pageType);

    if (!container) {
      return { success: false, error: '无法找到文章内容' };
    }

    try {
      // Start image collection if downloading images
      if (downloadImages) {
        startImageCollection();
      }

      const clonedContainer = this.preprocessContainer(container);
      const turndownService = createTurndownService(downloadImages);
      
      let markdown = turndownService.turndown(clonedContainer);
      const frontMatter = this.generateFrontMatter(title, author, window.location.href, createdTime, editedTime);
      markdown = frontMatter + markdown;
      markdown = markdown.replace(/\n{3,}/g, '\n\n');

      const filename = cleanFilename(title || 'zhihu-article') + '.md';

      // Get collected images if in download mode
      const images = downloadImages ? stopImageCollection() : [];

      return {
        success: true,
        data: {
          content: markdown,
          filename: filename,
          images: images,
          downloadImages: downloadImages
        }
      };
    } catch (error) {
      if (downloadImages) {
        stopImageCollection();
      }
      return { success: false, error: '导出过程中发生错误: ' + error.message };
    }
  }
};

// Export
if (typeof window !== 'undefined') {
  window.ArticleExporter = ArticleExporter;
}
