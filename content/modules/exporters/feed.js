/**
 * Feed Exporter Module
 * Handles export for home page and follow page feeds
 */

const FeedExporter = {
  /**
   * Scroll to load more feed items
   * @param {number} targetCount 
   * @returns {Promise<number>}
   */
  async scrollToLoadFeedItems(targetCount) {
    const startTime = Date.now();
    const maxTime = CONSTANTS.DEFAULTS.SCROLL_TIMEOUT;
    let lastCount = 0;
    let noChangeCount = 0;

    while (Date.now() - startTime < maxTime) {
      let currentItems = document.querySelectorAll('.TopstoryItem');
      if (currentItems.length === 0) {
        currentItems = document.querySelectorAll('.Feed > .ContentItem, .ContentItem');
      }
      const currentCount = currentItems.length;

      if (currentCount >= targetCount) {
        return currentCount;
      }

      if (currentCount === lastCount) {
        noChangeCount++;
        if (noChangeCount >= 3) {
          return currentCount;
        }
      } else {
        noChangeCount = 0;
      }
      lastCount = currentCount;

      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.DEFAULTS.SCROLL_INTERVAL));
    }

    const items = document.querySelectorAll('.TopstoryItem');
    return items.length > 0 ? items.length : document.querySelectorAll('.ContentItem').length;
  },

  /**
   * Process a single feed item and extract content
   * @param {Element} feedItem 
   * @param {TurndownService} turndownService 
   * @returns {Promise<Object|null>}
   */
  async processFeedItem(feedItem, turndownService) {
    const titleEl = feedItem.querySelector('.ContentItem-title a, [class*="ContentItem-title"] a, h2 a');
    const authorEl = feedItem.querySelector('.AuthorInfo-name, .UserLink-link, [class*="AuthorInfo"] a');
    const timeEl = feedItem.querySelector('.ContentItem-time, [class*="ContentItem-time"]');
    const linkEl = feedItem.querySelector('a[href*="/question/"], a[href*="/p/"], h2 a');

    if (!titleEl) {
      return null;
    }

    const title = titleEl?.textContent?.trim() || '无标题';
    const author = authorEl?.textContent?.trim() || '未知作者';
    const href = linkEl?.getAttribute('href') || '';
    const fullUrl = normalizeUrl(href);
    const timeText = timeEl?.textContent?.trim() || '';

    // Try to expand content
    let expandBtn = feedItem.querySelector(
      'button.ContentItem-more, ' +
      'button[class*="ContentItem-more"], ' +
      '.ContentItem-expandButton, ' +
      '[class*="ContentItem"] button[class*="expand"], ' +
      '.RichContent-inner button, ' +
      '.Button--plain'
    );

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
        expandBtn.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // Ignore expand errors
      }
    }

    const contentEl = feedItem.querySelector('.RichText, .RichContent-inner, [class*="RichText"]');

    let contentMd = '';
    if (contentEl) {
      const clonedContent = contentEl.cloneNode(true);
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
        maxItemCount = settings.maxAnswerCount;
      } catch (e) {
        // Use default
      }

      await this.scrollToLoadFeedItems(maxItemCount);

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

      // Deduplicate by title
      const seenTitles = new Set();
      const uniqueItems = [];

      for (const item of feedItems) {
        const titleEl = item.querySelector('.ContentItem-title a, [class*="ContentItem-title"] a, h2 a');
        const title = titleEl?.textContent?.trim();

        if (title && !seenTitles.has(title)) {
          seenTitles.add(title);
          uniqueItems.push(item);
        }
      }

      const itemsToProcess = uniqueItems.slice(0, maxItemCount);

      if (itemsToProcess.length === 0) {
        return { success: false, error: '未找到任何内容' };
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
title: "${pageTitle}"
url: ${window.location.href}
date: ${date}
item_count: ${processedItems.length}
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

        markdown += `  
**链接**: [查看原文](${item.url})

${item.content}

`;
      });

      markdown = markdown.replace(/\n{3,}/g, '\n\n');
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

// Export
if (typeof window !== 'undefined') {
  window.FeedExporter = FeedExporter;
}
