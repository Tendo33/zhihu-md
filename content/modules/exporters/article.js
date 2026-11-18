/**
 * Article Exporter Module
 * Handles export for single column articles and answers
 */

import { failureResult } from '../../../lib/failure-reason.js';
import { DEFAULT_IMAGE_DIR, normalizeImageDir } from '../../../lib/image-pack.js';
import { parseHtmlInert } from '../../../lib/safe-dom.js';
import { CONSTANTS, cleanFilename, querySelectorAny } from '../constants.js';
import { PageDetector } from '../detector.js';
import { createTurndownService, tidyMarkdown } from '../turndown-rules.js';
import {
  authorUrlFromApi,
  fetchAnswerRecord,
  findAnswerItem,
  findAuthorName,
  findAuthorUrl,
  formatUnixTime,
  parseZhihuTime,
  yamlQuote,
} from '../zhihu-dom.js';

export const ArticleExporter = {
  /**
   * Get article content container based on page type
   * @param {string} pageType 
   * @returns {Element|null}
   */
  getContentContainer(pageType) {
    if (pageType === 'column') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.COLUMN_CONTAINER);
    } else if (pageType === 'answer') {
      const answerId = window.location.pathname.match(/\/answer\/(\d+)/)?.[1] || '';
      const answerElement = findAnswerItem(document, answerId);
      if (!answerElement) return null;
      return querySelectorAny(answerElement, ['.RichText.ztext', '.RichText']);
    } else if (pageType === 'question') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.ANSWER_CONTAINER);
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
      return querySelectorAny(document, CONSTANTS.SELECTORS.TITLE.COLUMN)?.textContent?.trim() || document.querySelector('meta[property="og:title"]')?.content?.trim();
    } else if (pageType === 'answer' || pageType === 'question') {
      return querySelectorAny(document, CONSTANTS.SELECTORS.TITLE.ANSWER)?.textContent?.trim() || document.querySelector('meta[property="og:title"]')?.content?.trim();
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
      const answerId = pageType === 'answer' ? window.location.pathname.match(/\/answer\/(\d+)/)?.[1] : '';
      const answerItem = findAnswerItem(document, answerId);
      return findAuthorName(answerItem) || null;
    }
    return null;
  },

  /**
   * Get author profile link
   * @param {string} pageType
   * @returns {string}
   */
  getAuthorUrl(pageType) {
    if (pageType === 'column') {
      // 只从作者块里找，别把正文或推荐位里的 @ 提及当成作者
      return findAuthorUrl(querySelectorAny(document, CONSTANTS.SELECTORS.AUTHOR.COLUMN));
    } else if (pageType === 'answer' || pageType === 'question') {
      const answerId = pageType === 'answer' ? window.location.pathname.match(/\/answer\/(\d+)/)?.[1] : '';
      return findAuthorUrl(findAnswerItem(document, answerId));
    }
    return '';
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
      const timeEl = querySelectorAny(document, ['.Post-Header .ContentItem-time', '.ContentItem-time']);
      return parseZhihuTime(timeEl?.textContent || '');
    }
    if (pageType === 'answer') {
      const answerId = window.location.pathname.match(/\/answer\/(\d+)/)?.[1] || '';
      const answerItem = findAnswerItem(document, answerId);
      const timeEl = answerItem?.querySelector('.ContentItem-time');
      return parseZhihuTime(timeEl?.textContent || '');
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
   * @param {string} authorUrl
   * @returns {string}
   */
  generateFrontMatter(title, author, url, createdTime = '', editedTime = '', authorUrl = '') {
    const date = new Date().toISOString().split('T')[0];
    let frontMatter = `---
title: ${yamlQuote(title)}
url: ${yamlQuote(url)}
author: ${yamlQuote(author || '未知')}`;

    // 回答被删后还能从作者主页找回内容，所以把主页链接一起写进 Front Matter
    if (authorUrl) {
      frontMatter += `\nauthor_url: ${yamlQuote(authorUrl)}`;
    }

    frontMatter += `\ndate: ${date}`;

    if (createdTime) {
      frontMatter += `\ncreated: ${yamlQuote(createdTime)}`;
    }
    if (editedTime) {
      frontMatter += `\nedited: ${yamlQuote(editedTime)}`;
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

    // batch6 ZB5-03：把相邻文本节点合并。回答页（React 渲染、API 正文）里「<尖括号>」常被拆成「<」「尖括号」「>」几个文本节点，
    // turndown 按文本节点转义，行首的「>」会变成「\>」；合并后与专栏页一致，导出「<尖括号>」。
    clonedContainer.normalize();
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
      return failureResult();
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
   * Read the configured image folder for ZIP exports
   * @returns {Promise<string>}
   */
  async getImageDir() {
    try {
      const settings = await new Promise((resolve) => {
        chrome.storage.sync.get({ imageDir: DEFAULT_IMAGE_DIR }, resolve);
      });
      return normalizeImageDir(settings.imageDir).dir;
    } catch {
      return DEFAULT_IMAGE_DIR;
    }
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
    let author = this.getAuthor(pageType);
    let authorUrl = this.getAuthorUrl(pageType);
    let container = this.getContentContainer(pageType);
    let { createdTime, editedTime } = this.getTimeInfo(pageType);

    if (!container && pageType === 'answer') {
      const answerId = window.location.pathname.match(/\/answer\/(\d+)/)?.[1] || '';
      const record = await fetchAnswerRecord(answerId);
      if (record?.content) {
        container = parseHtmlInert(record.content);
        author = record.author?.name || author;
        authorUrl = authorUrlFromApi(record.author) || authorUrl;
        createdTime = formatUnixTime(record.created_time);
        editedTime = record.updated_time && record.updated_time !== record.created_time
          ? formatUnixTime(record.updated_time)
          : '';
      }
    }

    if (!container) {
      return failureResult();
    }

    try {
      const imageDir = downloadImages ? await this.getImageDir() : DEFAULT_IMAGE_DIR;
      const clonedContainer = this.preprocessContainer(container);
      const turndownService = createTurndownService(downloadImages, imageDir);
      
      let markdown = turndownService.turndown(clonedContainer);
      const frontMatter = this.generateFrontMatter(
        title, author, window.location.href, createdTime, editedTime, authorUrl
      );
      markdown = frontMatter + markdown;
      markdown = tidyMarkdown(markdown);

      const filename = cleanFilename(title || 'zhihu-article') + '.md';

      const images = downloadImages && turndownService.imageCollector
        ? turndownService.imageCollector.images
        : [];

      return {
        success: true,
        data: {
          content: markdown,
          filename: filename,
          images: images,
          downloadImages: downloadImages,
          imageDir: imageDir
        }
      };
    } catch (error) {
      return { success: false, error: '导出过程中发生错误: ' + error.message };
    }
  }
};

