/**
 * Hot List Exporter Module
 * Handles export for Zhihu hot list page
 */

import { failureResult } from '../../../lib/failure-reason.js';
import { extractHotFallback, extractHotItems } from '../zhihu-dom.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeLinkText(text) {
  return String(text || '').replace(/[[\]]/g, '\\$&').replace(/\s+/g, ' ').trim();
}

export const HotExporter = {
  /**
   * Export hot list items from /hot page
   * @returns {Promise<Object>}
   */
  async exportHotList() {
    try {
      const start = Date.now();
      while (!document.querySelector('.HotItem') && Date.now() - start < 1500) {
        await sleep(100);
      }

      // .HotItem is the row. [class*="HotItem-content"] also matches the inner
      // wrapper, and the row's <a> contains the excerpt, so neither can be used
      // as the title or the item list.
      let items = extractHotItems(document);
      if (items.length === 0) items = extractHotFallback(document);

      if (items.length === 0) {
        return failureResult();
      }

      const date = new Date().toISOString().split('T')[0];
      let markdown = `---
title: "知乎热榜"
url: ${window.location.href}
date: ${date}
count: ${items.length}
---

# 知乎热榜

`;

      items.forEach((item) => {
        markdown += `${item.rank}. [${escapeLinkText(item.title)}](${item.url})`;
        if (item.metrics) markdown += ` - ${item.metrics}`;
        markdown += '\n';
      });

      return {
        success: true,
        data: {
          content: markdown,
          filename: `知乎热榜_${date}.md`
        }
      };
    } catch (error) {
      return { success: false, error: '导出失败: ' + error.message };
    }
  }
};
