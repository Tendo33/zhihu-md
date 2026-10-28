/**
 * Floating Ball Module
 * Handles the floating export button UI and interactions
 */

import { ArticleExporter } from './exporters/article.js';
import { FeedExporter } from './exporters/feed.js';
import { HotExporter } from './exporters/hot.js';
import { QuestionExporter } from './exporters/question.js';
import { PageDetector } from './detector.js';
import { copyText, copyTextLater } from '../../lib/clipboard.js';
import { selectionToMarkdown } from './selection-md.js';
import { floatingBallDrag } from './floating-ball-drag.js';
import { applyBallA11y, IDLE_LABEL } from './ball-a11y.js';
import { describeFailure } from '../../lib/failure-text.js';

const idleLabel = '点击下载 · 右键复制';

const GLYPH = '<span class="glyph" aria-hidden="true">M↓</span>';
export const BALL_FACE = {
  idle: GLYPH,
  loading: GLYPH,
  success: '<svg class="icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  error: '<svg class="icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg>',
};

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
    ball.setAttribute('aria-label', IDLE_LABEL);
    ball.innerHTML = `<span class="ring" aria-hidden="true"></span><span class="face">${BALL_FACE.idle}</span><span class="tooltip" aria-hidden="true">${idleLabel}</span>`;

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

    if (state === 'loading' || state === 'success' || state === 'error') ball.classList.add(state);
    const face = ball.querySelector('.face');
    // Z3-2：导出中保留 M↓ 字形，靠外圈进度环表示；成功/失败换成勾/叹号
    if (face) face.innerHTML = BALL_FACE[state] || BALL_FACE.idle;
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
  /** 按钮里的子元素对读屏是“展示性”的，播报区放在按钮外面 */
  getLiveRegion() {
    let live = document.getElementById('zhihu-md-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'zhihu-md-live';
      live.className = 'zhihu-md-live';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    return live;
  },

  /** 提示文字、读屏播报和 aria-label 一起更新 */
  setMessage(ball, message, state) {
    ball.querySelector('.tooltip').textContent = message;
    const live = this.getLiveRegion();
    if (live) {
      live.setAttribute('role', state === 'error' ? 'alert' : 'status');
      live.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
      live.textContent = state === 'normal' ? '' : message;
    }
    const current = state || (ball.classList.contains('loading') ? 'loading' : 'normal');
    applyBallA11y(ball, current, message);
  },

  finishBall(ball, generation, state, message) {
    if (generation !== this.operation) return;
    this.busy = false;
    this.updateBallState(ball, state);
    this.setMessage(ball, message, state);
    // 成功提示短暂停留；失败原因一直显示，直到下一次操作（Round 2：错误持续可见）
    if (state === 'success') {
      setTimeout(() => this.finishBall(ball, generation, 'normal', idleLabel), 4000);
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
      this.setMessage(ball, '加载内容中...');
    } else if (pageType === 'hot') {
      this.setMessage(ball, '导出热榜...');
    } else {
      this.setMessage(ball, downloadImages ? '下载图片中...' : '导出中...');
    }

    try {
      let result;
      if (pageType === 'question') {
        result = await QuestionExporter.exportMultipleAnswers(downloadImages);
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
      } else if (result.reason) {
        // 页面未加载完 / 需要登录 / 安全验证：直接告诉用户怎么办
        this.finishBall(ball, generation, 'error', result.error);
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      this.finishBall(ball, generation, 'error', describeFailure(error, 'export').text);
    }
  },

  /**
   * Round 3：快捷键 / 右键菜单触发导出。有悬浮球就在球上反馈；用户关掉了悬浮球时，
   * 用一个不挂到页面的球元素跑同一流程，结果仍经 live region 播报。
   */
  exportFromCommand() {
    const ball = document.getElementById('zhihu-md-floating-ball') || this.createFloatingBall();
    return this.handleBallClick(ball);
  },

  /** Round 3 C-3：右键菜单「复制本页 Markdown」 */
  copyFromCommand() {
    const ball = document.getElementById('zhihu-md-floating-ball') || this.createFloatingBall();
    return this.copyMarkdown(ball);
  },

  /** Round 3 C-3：右键菜单「复制选中内容为 Markdown」，结果在悬浮球上反馈 */
  copySelection(selection = window.getSelection()) {
    const ball = document.getElementById('zhihu-md-floating-ball') || this.createFloatingBall();
    const generation = ++this.operation;
    const md = selectionToMarkdown(selection);
    if (!md) {
      this.finishBall(ball, generation, 'error', '没有选中内容，先选中一段文字再复制');
      return Promise.resolve(false);
    }
    return copyText(md).then(() => {
      this.finishBall(ball, generation, 'success', '已复制选中内容');
      return true;
    }).catch((error) => {
      this.finishBall(ball, generation, 'error', describeFailure(error, 'copy').text);
      return false;
    });
  },

  copyMarkdown(ball) {
    if (this.busy) return;
    this.busy = true;
    const generation = ++this.operation;
    this.updateBallState(ball, 'loading');
    this.setMessage(ball, '复制中...');
    const pending = copyTextLater(async () => {
      const pageType = PageDetector.detectPageType();
      let result;
      if (pageType === 'question') result = await QuestionExporter.exportMultipleAnswers();
      else if (pageType === 'home' || pageType === 'follow') result = await FeedExporter.exportFeedItems(pageType);
      else if (pageType === 'hot') result = await HotExporter.exportHotList();
      else result = await ArticleExporter.exportMarkdown(false);
      if (!result || !result.success) {
        const failure = new Error(result?.error || '复制失败');
        failure.reason = result?.reason;
        throw failure;
      }
      return result.data.content;
    });
    pending.then(() => {
      this.finishBall(ball, generation, 'success', '已复制');
    }).catch((error) => {
      console.error('[Zhihu-MD] copy failed', error);
      this.finishBall(ball, generation, 'error', describeFailure(error, 'copy').text);
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
  init(attempt = 0) {
    if (!PageDetector.isValidArticlePage()) {
      this.remove();
      return;
    }

    // Wait for real content; skip error, JSON and security-check pages
    if (!PageDetector.hasContent()) {
      this.remove();
      clearTimeout(this._contentRetryTimer);
      if (attempt < 10) {
        this._contentRetryTimer = setTimeout(() => this.init(attempt + 1), 1000);
      }
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
    const live = document.getElementById('zhihu-md-live');
    if (live) live.remove();
  }
};
