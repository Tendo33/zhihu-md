/**
 * Question Page Exporter Module
 * Handles export for multiple answers on question pages
 */

const QuestionExporter = {
  /**
   * Process a single answer element and extract content
   * @param {Element} answerItem 
   * @param {TurndownService} turndownService 
   * @returns {Object|null}
   */
  processAnswerContent(answerItem, turndownService) {
    const authorEl = answerItem.querySelector('.AuthorInfo-name') ||
      answerItem.querySelector('.UserLink-link');
    const author = authorEl?.textContent?.trim() || '匿名用户';

    let createdTime = '';
    let editedTime = '';

    const timeEl = answerItem.querySelector('.ContentItem-time');
    if (timeEl) {
      const timeText = timeEl.textContent || '';
      const createdMatch = timeText.match(/发布于\s*([^\s编]+)/);
      const editedMatch = timeText.match(/编辑于\s*(.+)/);
      if (createdMatch) createdTime = createdMatch[1].trim();
      if (editedMatch) editedTime = editedMatch[1].trim();
    }

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

    const contentEl = answerItem.querySelector('.RichText.ztext');
    if (!contentEl) return null;

    const clonedContent = contentEl.cloneNode(true);

    CONSTANTS.SELECTORS.UNWANTED.forEach(selector => {
      clonedContent.querySelectorAll(selector).forEach(el => el.remove());
    });
    clonedContent.querySelectorAll('noscript').forEach(el => el.remove());

    const markdown = turndownService.turndown(clonedContent);

    return {
      author,
      createdTime,
      editedTime,
      content: markdown
    };
  },

  /**
   * Scroll page to load more answers
   * @param {number} targetCount 
   * @returns {Promise<number>}
   */
  async scrollToLoadAnswers(targetCount) {
    const startTime = Date.now();
    const maxTime = CONSTANTS.DEFAULTS.SCROLL_TIMEOUT;
    let lastCount = 0;
    let noChangeCount = 0;

    while (Date.now() - startTime < maxTime) {
      const currentAnswers = document.querySelectorAll('.AnswerItem');
      const currentCount = currentAnswers.length;

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

    return document.querySelectorAll('.AnswerItem').length;
  },

  /**
   * Export multiple answers from question page
   * @returns {Promise<Object>}
   */
  async exportMultipleAnswers() {
    const pageType = PageDetector.detectPageType();
    if (pageType !== 'question') {
      return ArticleExporter.exportMarkdown();
    }

    try {
      let maxAnswerCount = CONSTANTS.DEFAULTS.MAX_ANSWER_COUNT;
      try {
        const settings = await new Promise(resolve => {
          chrome.storage.sync.get({ maxAnswerCount: 20 }, resolve);
        });
        maxAnswerCount = settings.maxAnswerCount;
      } catch (e) {
        // Use default
      }

      await this.scrollToLoadAnswers(maxAnswerCount);

      const answerItems = document.querySelectorAll('.AnswerItem');
      const answersToProcess = Array.from(answerItems).slice(0, maxAnswerCount);

      if (answersToProcess.length === 0) {
        return { success: false, error: '未找到任何回答' };
      }

      const title = ArticleExporter.getTitle('question') || '未知问题';
      const date = new Date().toISOString().split('T')[0];
      const turndownService = createTurndownService();

      const processedAnswers = [];
      for (let i = 0; i < answersToProcess.length; i++) {
        const answer = this.processAnswerContent(answersToProcess[i], turndownService);
        if (answer) {
          processedAnswers.push(answer);
        }
      }

      if (processedAnswers.length === 0) {
        return { success: false, error: '无法解析回答内容' };
      }

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

      markdown = markdown.replace(/\n{3,}/g, '\n\n');
      const filename = cleanFilename(title) + '_多回答.md';

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
  window.QuestionExporter = QuestionExporter;
}
