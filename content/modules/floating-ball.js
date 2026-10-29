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
import { applyBallA11y, idleAriaLabel } from './ball-a11y.js';
import { t, tn } from './i18n.js';
import { ballFailureText, ballImageSrExtra, ballKeptSrExtra } from './ball-text.js';
import { span, svgIcon } from '../../lib/safe-dom.js';
import { placeTooltip } from './tooltip-layout.js';

// 悬浮球上面向用户的文字都走 _locales（chrome.i18n），见 i18n.js / ball-text.js
const idleLabel = () => t('ballTooltipIdle');

/** 空闲提示拆成两个不换行短语，空格在 span 外：窄屏只在「·」后折行（R12）。用 createElement/textContent 构建。 */
export function idleTooltipNodes() {
  return [span('nw', t('ballTooltipIdlePart1')), ' ', span('nw', t('ballTooltipIdlePart2'))];
}

// 状态文字里不能从中间折开的短语（设计复核 e2fa5da：320 下成功提示曾折成 “couldn't be / downloaded”）
export const NOWRAP_PHRASES = ["couldn't be downloaded"];

/** 把状态文字切成文本节点和 .nw 不换行段（createElement，不用 innerHTML） */
export function messageNodes(message) {
  const out = [];
  let rest = String(message);
  for (;;) {
    const hits = NOWRAP_PHRASES.map((p) => [rest.indexOf(p), p]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]);
    if (!hits.length) break;
    const [i, p] = hits[0];
    if (i > 0) out.push(rest.slice(0, i));
    out.push(span('nw', p));
    rest = rest.slice(i + p.length);
  }
  if (rest) out.push(rest);
  return out;
}

/** 写入提示：空闲文案用分段结构，其余状态文字按不换行短语切段 */
export function setTooltipText(tip, message) {
  if (!tip) return;
  if (message === idleLabel()) tip.replaceChildren(...idleTooltipNodes());
  else tip.replaceChildren(...messageNodes(message));
}

// Z3-2：导出中保留 M↓ 字形，靠外圈进度环表示；成功/失败换成勾/叹号
export const BALL_FACE = {
  idle: () => span('glyph', 'M↓', { 'aria-hidden': 'true' }),
  loading: () => span('glyph', 'M↓', { 'aria-hidden': 'true' }),
  success: () => svgIcon('check', 'icon'),
  error: () => svgIcon('alert', 'icon'),
  warning: () => svgIcon('warn', 'icon'),
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
    ball.setAttribute('aria-label', idleAriaLabel());
    ball.append(
      span('ring', null, { 'aria-hidden': 'true' }),
      span('face'),
      span('tooltip', null, { 'aria-hidden': 'true' }),
    );
    ball.querySelector('.face').append(BALL_FACE.idle());
    setTooltipText(ball.querySelector('.tooltip'), idleLabel());

    document.body.appendChild(ball);
    return ball;
  },

  /**
   * Update ball state (loading, success, error)
   * @param {HTMLElement} ball 
   * @param {string} state 
   */
  updateBallState(ball, state) {
    ball.classList.remove('loading', 'success', 'error', 'warning');

    if (state === 'loading' || state === 'success' || state === 'error' || state === 'warning') ball.classList.add(state);
    const face = ball.querySelector('.face');
    if (face) face.replaceChildren((BALL_FACE[state] || BALL_FACE.idle)());
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
  setMessage(ball, message, state, srExtra = '', srSep = t('ballSep')) {
    setTooltipText(ball.querySelector('.tooltip'), message);
    const spoken = srExtra ? `${message}${srSep}${srExtra}` : message;
    const live = this.getLiveRegion();
    if (live) {
      live.setAttribute('role', state === 'error' ? 'alert' : 'status');
      live.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
      live.textContent = state === 'normal' ? '' : spoken;
    }
    const current = state || (ball.classList.contains('loading') ? 'loading' : 'normal');
    applyBallA11y(ball, current, spoken);
    placeTooltip(ball);
  },

  finishBall(ball, generation, state, message, srExtra = '', srSep = t('ballSep')) {
    if (generation !== this.operation) return;
    this.busy = false;
    this.updateBallState(ball, state);
    this.setMessage(ball, message, state, srExtra, srSep);
    // 成功提示短暂停留；失败原因一直显示，直到下一次操作（Round 2：错误持续可见）
    if (state === 'success') {
      setTimeout(() => this.finishBall(ball, generation, 'normal', idleLabel()), 4000);
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
      this.setMessage(ball, t('ballLoadingContent'));
    } else if (pageType === 'hot') {
      this.setMessage(ball, t('ballExportingHot'));
    } else {
      this.setMessage(ball, downloadImages ? t('ballDownloadingImages') : t('ballExporting'));
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

        const dl = await chrome.runtime.sendMessage(messageData);

        if (result.data.partial) {
          // 发版 QA ZR-02 / 设计 M1：文件已保存但不完整 → 警告态（琥珀色三角，持续显示，polite 播报）
          // QA P2Z-02：tooltip 不变，读屏末尾补上图片失败数和保留数（与弹窗琥珀提示的图片行一致）
          const srExtra = ballImageSrExtra((dl && dl.failedImages) || 0, (dl && dl.keptImages) || 0);
          const { exported, total } = result.data.partial;
          this.finishBall(ball, generation, 'warning', t('ballPartial', exported, total, total - exported), srExtra, t('ballPartialSep'));
        } else {
          // 发版 QA ZR-09：部分图片没打进 zip 时，成功提示里带上数量
          // 第三轮 B：只有 kept 按普通成功处理，tooltip 不变，读屏末尾补一句；数字只算失败
          const failedN = (dl && dl.failedImages) || 0;
          const keptN = (dl && dl.keptImages) || 0;
          const srExtra = ballKeptSrExtra(failedN, keptN);
          this.finishBall(ball, generation, 'success', failedN > 0 ? tn('ballExportedImagesFailed', failedN) : t('ballExported'), srExtra);
        }
      } else if (result.reason) {
        // 页面未加载完 / 需要登录 / 安全验证：直接告诉用户怎么办
        this.finishBall(ball, generation, 'error', ballFailureText(result, 'export'));
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      this.finishBall(ball, generation, 'error', ballFailureText(error, 'export'));
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

  /** Round 3 C-3：右键菜单「复制本页为 Markdown」 */
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
      this.finishBall(ball, generation, 'error', t('ballNoSelection'));
      return Promise.resolve(false);
    }
    return copyText(md).then(() => {
      this.finishBall(ball, generation, 'success', t('ballCopiedSelection'));
      return true;
    }).catch((error) => {
      this.finishBall(ball, generation, 'error', ballFailureText(error, 'copy'));
      return false;
    });
  },

  copyMarkdown(ball) {
    if (this.busy) return;
    this.busy = true;
    const generation = ++this.operation;
    this.updateBallState(ball, 'loading');
    this.setMessage(ball, t('ballCopying'));
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
      this.finishBall(ball, generation, 'success', t('ballCopied'));
    }).catch((error) => {
      console.error('[Zhihu-MD] copy failed', error);
      this.finishBall(ball, generation, 'error', ballFailureText(error, 'copy'));
    });
  },

  /**
   * Setup ball element with all event handlers
   */
  setupBallElement() {
    const existingBall = this.createFloatingBall();
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
    // QA e2fa5da P4：位置恢复写在页面上的这个球上（之前写在被替换掉的原球上），量得到真实尺寸再夹到视口内
    this.restorePosition(newBall);

    // R12：显示提示前按球的当前位置重新排版（拖动、吸边、窗口缩放后都成立）
    const place = () => placeTooltip(newBall);
    newBall.addEventListener('mouseenter', place);
    newBall.addEventListener('focus', place);
    // 拖动结束（含吸边）后下一帧再排，此时 .dragging 已去掉、提示可测量
    const placeNextFrame = () => requestAnimationFrame(place);
    newBall.addEventListener('mouseup', placeNextFrame);
    newBall.addEventListener('touchend', placeNextFrame);
    // 审查 P3：resize 监听挂在 window 上，重建或 remove() 时摘掉，避免对已移除的球继续排版
    this.detachResize();
    this._onResize = () => { this.clampToViewport(newBall); place(); };
    window.addEventListener('resize', this._onResize);
    place();

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
  detachResize() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this._onResize = null;
  },

  remove() {
    this.detachResize();
    const ball = document.getElementById('zhihu-md-floating-ball');
    if (ball) {
      ball.remove();
    }
    const live = document.getElementById('zhihu-md-live');
    if (live) live.remove();
  }
};
