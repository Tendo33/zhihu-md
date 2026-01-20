/**
 * Hot List Exporter Module
 * Handles export for Zhihu hot list page
 */

const HotExporter = {
  /**
   * Export hot list items from /hot page
   * @returns {Promise<Object>}
   */
  async exportHotList() {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const hotItems = document.querySelectorAll('.HotList-item, .HotItem, [class*="HotItem"]');

      if (hotItems.length === 0) {
        const altItems = document.querySelectorAll('.HotList .HotItem-content, .css-1xgfyz0');
        if (altItems.length === 0) {
          return { success: false, error: '未找到热榜内容，请确保在热榜页面' };
        }
      }

      const items = [];

      const hotListItems = document.querySelectorAll('.HotList-item, .HotItem, [class*="HotItem-content"]');

      hotListItems.forEach((item, index) => {
        const titleEl = item.querySelector('.HotItem-title, [class*="HotItem-title"], a[href*="/question/"]');
        const linkEl = item.querySelector('a[href*="/question/"]') || item.querySelector('a');
        const rankEl = item.querySelector('.HotItem-rank, .HotItem-index, [class*="index"]');
        const metricsEl = item.querySelector('.HotItem-metrics, [class*="metrics"]');

        if (titleEl || linkEl) {
          const title = titleEl?.textContent?.trim() || linkEl?.textContent?.trim() || '未知标题';
          const href = linkEl?.getAttribute('href') || '';
          const fullUrl = normalizeUrl(href);
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

      // Fallback method
      if (items.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/question/"]');
        const seenUrls = new Set();

        allLinks.forEach((link, index) => {
          const href = link.getAttribute('href');
          if (href && !seenUrls.has(href)) {
            seenUrls.add(href);
            const title = link.textContent?.trim() || '未知标题';
            if (title && title.length > 5) {
              items.push({
                rank: String(items.length + 1),
                title,
                url: normalizeUrl(href),
                metrics: ''
              });
            }
          }
        });
      }

      if (items.length === 0) {
        return { success: false, error: '未能提取热榜条目' };
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

      items.forEach(item => {
        markdown += `${item.rank}. [${item.title}](${item.url})`;
        if (item.metrics) {
          markdown += ` - ${item.metrics}`;
        }
        markdown += '\n';
      });

      const filename = `知乎热榜_${date}.md`;

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
  window.HotExporter = HotExporter;
}
