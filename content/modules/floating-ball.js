/**
 * Floating Ball Module
 * Handles the floating export button UI and interactions
 */

import { ArticleExporter } from './exporters/article.js';
import { FeedExporter } from './exporters/feed.js';
import { HotExporter } from './exporters/hot.js';
import { QuestionExporter } from './exporters/question.js';
import { PageDetector } from './detector.js';
import { copyTextLater } from '../../lib/clipboard.js';
import { floatingBallDrag } from './floating-ball-drag.js';

const idleLabel = '点击下载 · 右键复制';

export const FloatingBall = {
  ...floatingBallDrag,
  ball: null,
  checkHasMoved: null,
  busy: false,
  operation: 0,

  /**
   * Create floating ball DOM element
   * @returns {HTMLElement}
   */
  createFloatingBall() {
    if (document.getElementById('zhihu-md-floating-ball')) {
      return document.getElementById('zhihu-md-floating-ball');
    }

    const ball = document.createElement('button');
    ball.id = 'zhihu-md-floating-ball';
    ball.type = 'button';
    ball.setAttribute('aria-label', '导出 Markdown');
    ball.innerHTML = `
      <svg class="icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="tooltip">${idleLabel}</span>
    `;

    document.body.appendChild(ball);
    return ball;
  },

  /**
   * Update ball state (loading, success, error)
   * @param {HTMLElement} ball 
   * @param {string} state 
   */
  updateBallState(ball, state) {
    ball.classList.remove('loading', 'success', 'error');

    const iconSvg = ball.querySelector('.icon');

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
        iconSvg.innerHTML = `<polyline points="20 6 9 17 4 12"></polyline>`;
        break;
      case 'error':
        ball.classList.add('error');
        iconSvg.innerHTML = `
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        `;
        break;
      default:
        iconSvg.innerHTML = `
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        `;
    }
  },

  /**
   * Get user settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({
          downloadImages: false,
          maxAnswerCount: 20
        }, resolve);
      } else {
        resolve({ downloadImages: false, maxAnswerCount: 20 });
      }
    });
  },

  /**
   * Handle floating ball click export
   * @param {HTMLElement} ball 
   * @param {Function} checkHasMoved 
   */
  finishBall(ball, generation, state, message) {
    if (generation !== this.operation) return;
    this.busy = false;
    this.updateBallState(ball, state);
    ball.querySelector('.tooltip').textContent = message;
    if (state !== 'normal') {
      setTimeout(() => this.finishBall(ball, generation, 'normal', idleLabel), 1600);
    }
  },

  async handleBallClick(ball, checkHasMoved) {
    if (this.busy) return;
    if (checkHasMoved && checkHasMoved()) {
      return;
    }

    this.busy = true;
    const generation = ++this.operation;
    this.updateBallState(ball, 'loading');

    const pageType = PageDetector.detectPageType();
    const settings = await this.getSettings();
    const downloadImages = settings.downloadImages;

    if (pageType === 'question' || pageType === 'home' || pageType === 'follow') {
      ball.querySelector('.tooltip').textContent = '加载内容中...';
    } else if (pageType === 'hot') {
      ball.querySelector('.tooltip').textContent = '导出热榜...';
    } else {
      ball.querySelector('.tooltip').textContent = downloadImages ? '下载图片中...' : '导出中...';
    }

    try {
      let result;
      if (pageType === 'question') {
        result = await QuestionExporter.exportMultipleAnswers();
      } else if (pageType === 'home' || pageType === 'follow') {
        result = await FeedExporter.exportFeedItems(pageType);
      } else if (pageType === 'hot') {
        result = await HotExporter.exportHotList();
      } else {
        result = await ArticleExporter.exportMarkdown(downloadImages);
      }

      if (result.success) {
        const messageData = {
          action: 'download',
          filename: result.data.filename,
          content: result.data.content
        };

        // Include images if download mode
        if (result.data.images && result.data.images.length > 0) {
          messageData.images = result.data.images;
          messageData.downloadImages = true;
        }

        await chrome.runtime.sendMessage(messageData);

        this.finishBall(ball, generation, 'success', '导出成功!');
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      this.finishBall(ball, generation, 'error', '导出失败');
    }
  },

  copyMarkdown(ball) {
    if (this.busy) return;
    this.busy = true;
    const generation = ++this.operation;
    this.updateBallState(ball, 'loading');
    ball.querySelector('.tooltip').textContent = '复制中...';
    const pending = copyTextLater(async () => {
      const pageType = PageDetector.detectPageType();
      let result;
      if (pageType === 'question') result = await QuestionExporter.exportMultipleAnswers();
      else if (pageType === 'home' || pageType === 'follow') result = await FeedExporter.exportFeedItems(pageType);
      else if (pageType === 'hot') result = await HotExporter.exportHotList();
      else result = await ArticleExporter.exportMarkdown(false);
      if (!result || !result.success) throw new Error(result?.error || '复制失败');
      return result.data.content;
    });
    pending.then(() => {
      this.finishBall(ball, generation, 'success', '已复制');
    }).catch((error) => {
      console.error('[Zhihu-MD] copy failed', error);
      this.finishBall(ball, generation, 'error', '复制失败');
    });
  },

  /**
   * Setup ball element with all event handlers
   */
  setupBallElement() {
    const existingBall = this.createFloatingBall();
    this.restorePosition(existingBall);
    const newBall = existingBall.cloneNode(true);
    const checkHasMoved = this.initDrag(newBall);

    newBall.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleBallClick(newBall, checkHasMoved);
    });
    newBall.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.copyMarkdown(newBall);
    });

    if (existingBall.parentNode) {
      existingBall.parentNode.replaceChild(newBall, existingBall);
    } else {
      document.body.appendChild(newBall);
    }

    this.ball = newBall;
    this.checkHasMoved = checkHasMoved;
  },

  /**
   * Initialize floating ball
   */
  init() {
    if (!PageDetector.isValidArticlePage()) {
      this.remove();
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ showFloatingBall: true }, (items) => {
        if (!items.showFloatingBall) {
          this.remove();
          return;
        }
        this.setupBallElement();
      });
    } else {
      this.setupBallElement();
    }
  },

  /**
   * Remove floating ball
   */
  remove() {
    const ball = document.getElementById('zhihu-md-floating-ball');
    if (ball) {
      ball.remove();
    }
  }
};
