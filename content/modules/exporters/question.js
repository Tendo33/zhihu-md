/**
 * Question Page Exporter Module
 * Handles export for multiple answers on question pages
 */

import { failureResult } from '../../../lib/failure-reason.js';
import { partialHint, partialText } from '../../../lib/partial-export.js';
import { parseHtmlInert } from '../../../lib/safe-dom.js';
import { ArticleExporter } from './article.js';
import { CONSTANTS, cleanFilename } from '../constants.js';
import { PageDetector } from '../detector.js';
import { createTurndownService, tidyMarkdown } from '../turndown-rules.js';
import {
  answerIdFromItem,
  cleanText,
  fetchAnswerRecord,
  findAuthorName,
  findExpandButton,
  formatUnixTime,
  pageQuestionFeeds,
  parseZhihuTime,
  yamlQuote,
} from '../zhihu-dom.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const UNLIMITED_CAP = 1000;

export const QuestionExporter = {
  readAnswer(answerItem) {
    const contentEl = answerItem.querySelector('.RichText.ztext, .RichText');
    const id = answerIdFromItem(answerItem);
    if (!contentEl || !id) return null;
    const times = parseZhihuTime(answerItem.querySelector('.ContentItem-time')?.textContent || '');
    return {
      id,
      author: findAuthorName(answerItem) || '匿名用户',
      createdTime: times.createdTime,
      editedTime: times.editedTime,
      contentEl,
    };
  },

  renderAnswer(record, questionId, turndownService) {
    const clonedContent = ArticleExporter.preprocessContainer(record.contentEl);
    return {
      id: record.id,
      author: record.author,
      createdTime: record.createdTime,
      editedTime: record.editedTime,
      url: answerUrl(questionId, record.id),
      content: turndownService.turndown(clonedContent),
    };
  },

  getPageDeclaredAnswerCount() {
    const candidates = [
      '.QuestionAnswers-answers h4',
      '.List-headerText',
      '.QuestionAnswerStatus',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) {
        const match = el.textContent.match(/(\d[\d,]*)\s*个回答/);
        if (match) return parseInt(match[1].replace(/,/g, ''), 10);
      }
    }
    for (const heading of document.querySelectorAll('h4')) {
      const match = heading.textContent.match(/(\d[\d,]*)\s*个回答/);
      if (match) return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return 0;
  },

  async expandQuestionDetail() {
    const rich = document.querySelector('.QuestionRichText');
    if (!rich) return null;
    const button = findExpandButton(rich);
    if (button && rich.classList.contains('QuestionRichText--collapsed')) {
      button.click();
      const start = Date.now();
      const before = cleanText(rich).length;
      while (Date.now() - start < 2500) {
        const opened = !rich.classList.contains('QuestionRichText--collapsed');
        if (opened && cleanText(rich).length > before) break;
        await sleep(100);
      }
    }
    return rich;
  },

  async expandVisibleAnswers() {
    const pending = [];
    for (const item of document.querySelectorAll('.AnswerItem')) {
      const button = findExpandButton(item);
      const content = item.querySelector('.RichText, .RichContent-inner');
      if (!button || !content) continue;
      const before = cleanText(content).length;
      try {
        button.click();
      } catch {
        continue;
      }
      pending.push({ content, before });
    }
    if (pending.length === 0) return;
    const start = Date.now();
    while (Date.now() - start < 1200) {
      const waiting = pending.some(({ content, before }) => cleanText(content).length <= before + 20);
      if (!waiting) break;
      await sleep(100);
    }
  },

  async exportMultipleAnswers(downloadImages = false) {
    const pageType = PageDetector.detectPageType();
    if (pageType !== 'question') {
      return ArticleExporter.exportMarkdown(downloadImages);
    }

    try {
      let maxAnswerCount = CONSTANTS.DEFAULTS.MAX_ANSWER_COUNT;
      try {
        const settings = await new Promise((resolve) => {
          chrome.storage.sync.get({ maxAnswerCount: 20 }, resolve);
        });
        maxAnswerCount = settings.maxAnswerCount;
      } catch {
        // Use default
      }

      const questionId = window.location.pathname.match(/\/question\/(\d+)/)?.[1] || '';
      const declared = this.getPageDeclaredAnswerCount();
      const targetCount = maxAnswerCount === 0
        ? Math.min(declared > 0 ? declared : UNLIMITED_CAP, UNLIMITED_CAP)
        : maxAnswerCount;

      const detailEl = await this.expandQuestionDetail();
      await this.expandVisibleAnswers();

      const turndownService = createTurndownService(downloadImages);
      const domById = new Map();
      for (const item of document.querySelectorAll('.AnswerItem')) {
        const record = this.readAnswer(item);
        if (record) domById.set(record.id, record);
      }

      const title = ArticleExporter.getTitle('question') || '未知问题';
      const date = new Date().toISOString().split('T')[0];
      let detailMarkdown = '';
      if (detailEl) {
        const clone = detailEl.cloneNode(true);
        clone.querySelectorAll('button, svg').forEach((el) => el.remove());
        detailMarkdown = turndownService.turndown(ArticleExporter.preprocessContainer(clone));
      }

      let answers = [];
      let feedState = { rows: [], isEnd: true };
      if (questionId && targetCount > 0) {
        feedState = await pageQuestionFeeds({ questionId, targetCount });
        const seen = new Set();
        for (const target of feedState.rows) {
          const record = await this.recordFromFeed(target, questionId, turndownService, domById);
          if (!record || seen.has(record.id)) continue;
          seen.add(record.id);
          answers.push(record);
          if (answers.length >= targetCount) break;
        }
        if (!feedState.isEnd && answers.length > 0 && answers.length < targetCount) {
          for (const record of domById.values()) {
            if (seen.has(record.id)) continue;
            seen.add(record.id);
            answers.push(this.renderAnswer(record, questionId, turndownService));
            if (answers.length >= targetCount) break;
          }
        }
      }

      if (answers.length === 0) {
        answers = [...domById.values()]
          .slice(0, targetCount)
          .map((record) => this.renderAnswer(record, questionId, turndownService));
      }
      const truncated = Boolean(questionId) && !feedState.isEnd && answers.length > 0;
      // 发版 QA ZR-02：分页接口中途失败且没凑够条数 → 部分失败，正文末尾写明，UI 不显示成功
      const partial = truncated && feedState.failedPage > 0 && answers.length < targetCount
        ? { exported: answers.length, total: targetCount, failedPage: feedState.failedPage }
        : null;

      if (answers.length === 0) {
        return failureResult();
      }

      let markdown = `---
title: ${yamlQuote(title)}
url: ${yamlQuote(window.location.href)}
date: ${date}
answer_count: ${answers.length}${truncated ? '\ntruncated: true' : ''}
---

# ${title}

`;
      if (detailMarkdown.trim()) {
        markdown += `## 问题描述

${detailMarkdown}

`;
      }

      answers.forEach((answer, index) => {
        markdown += `---

## 回答 ${index + 1}

**作者**: ${answer.author}`;
        if (answer.createdTime) markdown += `  \n**创建于**: ${answer.createdTime}`;
        if (answer.editedTime) markdown += `  \n**编辑于**: ${answer.editedTime}`;
        if (answer.url) markdown += `  \n**链接**: [查看回答](${answer.url})`;
        markdown += `

${answer.content}

`;
      });

      if (partial) {
        markdown += `---

> ${partialText(partial)}：${partialHint(partial)}。
`;
      }

      markdown = tidyMarkdown(markdown);
      const images = downloadImages && turndownService.imageCollector
        ? turndownService.imageCollector.images
        : [];

      return {
        success: true,
        data: {
          content: markdown,
          filename: cleanFilename(title) + '_多回答.md',
          images,
          downloadImages: downloadImages && images.length > 0,
          ...(partial ? { partial } : {}),
        }
      };
    } catch (error) {
      return { success: false, error: '导出失败: ' + error.message };
    }
  },

  async recordFromFeed(target, questionId, turndownService, domById) {
    const id = String(target.id);
    let source = target;
    if (target.content_need_truncated || !target.content) {
      const full = await fetchAnswerRecord(id);
      if (full?.content) source = full;
    }
    const dom = domById.get(id);
    // perf：API 正文只解析一次；只有页面上也有这条回答时才需要比较两边的可见文本长度
    let holder = null;
    if (source.content) {
      holder = parseHtmlInert(source.content);
    }
    const domTextLen = dom ? cleanText(dom.contentEl).length : 0;
    // Visible text, not innerHTML: lazy-image attributes make a short answer look complete.
    if (dom && domTextLen > 0 && domTextLen >= (holder ? cleanText(holder).length : 0)) {
      return this.renderAnswer(dom, questionId, turndownService);
    }
    if (!source.content && !source.excerpt) {
      return dom ? this.renderAnswer(dom, questionId, turndownService) : null;
    }

    if (!holder) {
      holder = document.createElement('div');
      const paragraph = document.createElement('p');
      paragraph.textContent = source.excerpt || '';
      holder.appendChild(paragraph);
    }
    const prepared = ArticleExporter.preprocessContainer(holder);
    const createdTime = formatUnixTime(source.created_time);
    const editedTime = source.updated_time && source.updated_time !== source.created_time
      ? formatUnixTime(source.updated_time)
      : '';
    return {
      id,
      author: source.author?.name || dom?.author || '匿名用户',
      createdTime: createdTime || dom?.createdTime || '',
      editedTime: editedTime || dom?.editedTime || '',
      url: answerUrl(questionId, id),
      content: turndownService.turndown(prepared),
    };
  },
};

function answerUrl(questionId, answerId) {
  if (!questionId || !answerId) return '';
  return `https://www.zhihu.com/question/${questionId}/answer/${answerId}`;
}
