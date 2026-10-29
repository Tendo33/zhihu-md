/**
 * Feed Exporter Module
 * Handles export for home page and follow page feeds
 */

import { capAnswerCount, MAX_ANSWER_LIMIT } from '../../../lib/answer-limit.js';
import { failureResult } from '../../../lib/failure-reason.js';
import { CONSTANTS, normalizeUrl, scrollToLoadItemsWithReason } from '../constants.js';
import { createTurndownService, tidyMarkdown } from '../turndown-rules.js';
import {
  cleanText,
  findAuthorName,
  findExpandButton,
  findFeedLink,
  findFeedTimeText,
  findFeedTitle,
  parseZhihuTime,
  yamlQuote,
} from '../zhihu-dom.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const FeedExporter = {
  /**
   * Scroll to load more feed items
   * @param {number} targetCount 
   * @returns {Promise<{count: number, reason: 'limit'|'idle'|'timeout'}>}
   */
  async scrollToLoadFeedItems(targetCount) {
    return scrollToLoadItemsWithReason(() => {
      const items = document.querySelectorAll('.TopstoryItem');
      if (items.length > 0) return items.length;
      return document.querySelectorAll('.Feed > .ContentItem, .ContentItem').length;
    }, targetCount);
  },

  /**
   * Process a single feed item and extract content
   * @param {Element} feedItem 
   * @param {TurndownService} turndownService 
   * @returns {Promise<Object|null>}
   */
  async processFeedItem(feedItem, turndownService) {
    const author = findAuthorName(feedItem) || '未知作者';
    const linkEl = findFeedLink(feedItem);
    const fullUrl = normalizeUrl(linkEl?.getAttribute('href') || '');
    const parsedTime = parseZhihuTime(findFeedTimeText(feedItem));
    const timeText = [
      parsedTime.createdTime && `发布于 ${parsedTime.createdTime}`,
      parsedTime.editedTime && `编辑于 ${parsedTime.editedTime}`,
    ].filter(Boolean).join(' ');

    const expandBtn = findExpandButton(feedItem);
    if (expandBtn) {
      const before = cleanText(feedItem.querySelector('.RichText, .RichContent-inner')).length;
      try {
        expandBtn.click();
        const start = Date.now();
        while (Date.now() - start < 1200) {
          const after = cleanText(feedItem.querySelector('.RichText, .RichContent-inner'));
          if (after.length > before + 20) break;
          await sleep(100);
        }
      } catch {
        // The card can already be expanded.
      }
    }

    const contentEl = feedItem.querySelector('.RichText, .RichContent-inner');
    let contentMd = '';
    if (contentEl) {
      const clonedContent = contentEl.cloneNode(true);
      clonedContent.querySelectorAll('.ContentItem-actions, noscript, .RichText-ADLinkCardContainer, button').forEach(el => el.remove());
      contentMd = turndownService.turndown(clonedContent);
    }

    let title = findFeedTitle(feedItem);
    if (!title && !contentMd) return null;
    if (!title) title = author !== '未知作者' ? `${author}的想法` : '无标题';

    return {
      title,
      author,
      url: fullUrl,
      time: timeText,
      content: contentMd
    };
  },

  /**
   * Export feed items from home or follow page
   * @param {string} pageType 
   * @returns {Promise<Object>}
   */
  async exportFeedItems(pageType) {
    try {
      let maxItemCount = CONSTANTS.DEFAULTS.MAX_ANSWER_COUNT;
      try {
        const settings = await new Promise(resolve => {
          chrome.storage.sync.get({ maxAnswerCount: 20 }, resolve);
        });
        maxItemCount = capAnswerCount(settings.maxAnswerCount); // 旧值或同步来的大数字也截到 1000
      } catch (e) {
        // Use default
      }

      // 批量上限 1000（Simon 定）：0 表示「上限内不限」，信息流按 1000 条滚动加载
      const targetCount = maxItemCount === 0 ? MAX_ANSWER_LIMIT : maxItemCount;
      const scroll = await this.scrollToLoadFeedItems(targetCount);
      const stopReason = scroll && typeof scroll === 'object' ? scroll.reason : undefined;

      let feedItems = document.querySelectorAll('.TopstoryItem');
      if (feedItems.length === 0) {
        feedItems = document.querySelectorAll('.Feed > .ContentItem');
      }
      if (feedItems.length === 0) {
        feedItems = document.querySelectorAll('[class*="FeedItem"]');
      }
      if (feedItems.length === 0) {
        feedItems = document.querySelectorAll('.ContentItem');
      }

      const seenKeys = new Set();
      const uniqueItems = [];

      for (const item of feedItems) {
        const title = findFeedTitle(item);
        const href = normalizeUrl(findFeedLink(item)?.getAttribute('href') || '');
        const hasBody = item.querySelector('.RichText, .RichContent-inner, .ContentItem-more');
        if (!title && !href && !hasBody) continue;
        const key = href || title;
        if (key && seenKeys.has(key)) continue;
        if (key) seenKeys.add(key);
        uniqueItems.push(item);
      }

      const itemsToProcess = uniqueItems.slice(0, targetCount);
      // 和问题页一致，没下完时文首写 truncated: true：
      // 停在上限（含去重后不足目标条数）、或滚动超时 → 视为没下完；连续 3 轮没有新卡片（idle）时按卡片是否被上限截掉判断
      const truncated = stopReason === 'limit'
        || stopReason === 'timeout'
        || uniqueItems.length > itemsToProcess.length;

      if (itemsToProcess.length === 0) {
        return failureResult();
      }

      const turndownService = createTurndownService();

      const processedItems = [];
      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = await this.processFeedItem(itemsToProcess[i], turndownService);
        if (item) {
          processedItems.push(item);
        }
      }

      if (processedItems.length === 0) {
        return { success: false, error: '无法解析内容' };
      }

      const date = new Date().toISOString().split('T')[0];
      const pageTitle = pageType === 'home' ? '知乎首页推荐' : '知乎关注动态';

      let markdown = `---
title: ${yamlQuote(pageTitle)}
url: ${yamlQuote(window.location.href)}
date: ${date}
item_count: ${processedItems.length}${truncated ? '\ntruncated: true' : ''}
---

`;

      processedItems.forEach((item, index) => {
        markdown += `---

# ${index + 1}. ${item.title}

**作者**: ${item.author}`;

        if (item.time) {
          markdown += `  
**时间**: ${item.time}`;
        }

        if (item.url) {
          markdown += `  
**链接**: [查看原文](${item.url})`;
        }

        markdown += `

${item.content}

`;
      });

      markdown = tidyMarkdown(markdown);
      const filename = `${pageTitle}_${date}.md`;

      return {
        success: true,
        data: {
          content: markdown,
          filename: filename
        }
      };
    } catch (error) {
      return { success: false, error: '导出失败: ' + error.message };
    }
  }
};

