/**
 * Floating Ball Module
 * Handles the floating export button UI and interactions
 */

const FloatingBall = {
  ball: null,
  checkHasMoved: null,

  /**
   * Create floating ball DOM element
   * @returns {HTMLElement}
   */
  createFloatingBall() {
    if (document.getElementById('zhihu-md-floating-ball')) {
      return document.getElementById('zhihu-md-floating-ball');
    }

    const ball = document.createElement('div');
    ball.id = 'zhihu-md-floating-ball';
    ball.innerHTML = `
      <svg class="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="tooltip">导出 Markdown</span>
    `;

    document.body.appendChild(ball);
    return ball;
  },

  /**
   * Initialize drag functionality
   * @param {HTMLElement} ball 
   * @returns {Function} checkHasMoved function
   */
  initDrag(ball) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let hasMoved = false;
    let dockTimeout;

    const clearDockedState = () => {
      ball.classList.remove('docked-left', 'docked-right');
      if (dockTimeout) {
        clearTimeout(dockTimeout);
        dockTimeout = null;
      }
    };

    const checkHasMoved = () => hasMoved;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;

      isDragging = true;
      hasMoved = false;
      ball.classList.add('dragging');
      clearDockedState();

      const rect = ball.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
      ball.style.left = `${initialLeft}px`;
      ball.style.top = `${initialTop}px`;

      e.preventDefault();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = window.innerWidth - ball.offsetWidth;
      const maxTop = window.innerHeight - ball.offsetHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      ball.style.left = `${newLeft}px`;
      ball.style.top = `${newTop}px`;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      ball.classList.remove('dragging');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (hasMoved) {
        this.handleSnapAndDock(ball);
      }
    };

    // Touch events
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;

      isDragging = true;
      hasMoved = false;
      ball.classList.add('dragging');
      clearDockedState();

      const touch = e.touches[0];
      const rect = ball.getBoundingClientRect();
      startX = touch.clientX;
      startY = touch.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
      ball.style.left = `${initialLeft}px`;
      ball.style.top = `${initialTop}px`;

      e.preventDefault();
    };

    const onTouchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = window.innerWidth - ball.offsetWidth;
      const maxTop = window.innerHeight - ball.offsetHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      ball.style.left = `${newLeft}px`;
      ball.style.top = `${newTop}px`;
    };

    const onTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      ball.classList.remove('dragging');
      if (hasMoved) {
        this.handleSnapAndDock(ball);
      }
    };

    ball.addEventListener('mouseenter', clearDockedState);

    ball.addEventListener('mouseleave', () => {
      if (!isDragging) {
        const rect = ball.getBoundingClientRect();
        const winWidth = window.innerWidth;
        if (rect.left <= 5) {
          dockTimeout = setTimeout(() => ball.classList.add('docked-left'), 800);
        } else if (rect.right >= winWidth - 5) {
          dockTimeout = setTimeout(() => ball.classList.add('docked-right'), 800);
        }
      }
    });

    ball.addEventListener('mousedown', onMouseDown);
    ball.addEventListener('touchstart', onTouchStart, { passive: false });
    ball.addEventListener('touchmove', onTouchMove, { passive: false });
    ball.addEventListener('touchend', onTouchEnd);

    return checkHasMoved;
  },

  /**
   * Handle snap to edge and dock behavior
   * @param {HTMLElement} ball 
   */
  handleSnapAndDock(ball) {
    const rect = ball.getBoundingClientRect();
    const winWidth = window.innerWidth;

    this.savePosition(rect.left, rect.top);

    const docThreshold = 30;
    let dockedSide = null;

    if (rect.left < docThreshold) {
      ball.style.left = '0px';
      this.savePosition(0, rect.top);
      dockedSide = 'left';
    } else if (winWidth - rect.right < docThreshold) {
      ball.style.left = `${winWidth - rect.width}px`;
      this.savePosition(winWidth - rect.width, rect.top);
      dockedSide = 'right';
    }

    if (dockedSide) {
      setTimeout(() => {
        ball.classList.add(`docked-${dockedSide}`);
      }, 800);
    }
  },

  /**
   * Save floating ball position
   * @param {number} x 
   * @param {number} y 
   */
  savePosition(x, y) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ floatingBallPosition: { x, y } });
    }
  },

  /**
   * Restore floating ball position
   * @param {HTMLElement} ball 
   */
  restorePosition(ball) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['floatingBallPosition'], (result) => {
        if (result.floatingBallPosition) {
          const { x, y } = result.floatingBallPosition;

          const maxLeft = window.innerWidth - 40;
          const maxTop = window.innerHeight - 40;

          let validX = Math.max(0, Math.min(x, maxLeft));
          let validY = Math.max(0, Math.min(y, maxTop));

          ball.style.right = 'auto';
          ball.style.bottom = 'auto';
          ball.style.left = `${validX}px`;
          ball.style.top = `${validY}px`;

          if (validX <= 5) {
            setTimeout(() => ball.classList.add('docked-left'), 800);
          } else if (validX >= window.innerWidth - 45) {
            setTimeout(() => ball.classList.add('docked-right'), 800);
          }
        }
      });
    }
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
  async handleBallClick(ball, checkHasMoved) {
    if (checkHasMoved && checkHasMoved()) {
      return;
    }

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

        this.updateBallState(ball, 'success');
        ball.querySelector('.tooltip').textContent = '导出成功!';

        setTimeout(() => {
          this.updateBallState(ball, 'normal');
          ball.querySelector('.tooltip').textContent = '导出 Markdown';
        }, 2000);
      } else {
        throw new Error(result.error || '导出失败');
      }
    } catch (error) {
      this.updateBallState(ball, 'error');
      ball.querySelector('.tooltip').textContent = '导出失败';

      setTimeout(() => {
        this.updateBallState(ball, 'normal');
        ball.querySelector('.tooltip').textContent = '导出 Markdown';
      }, 2000);
    }
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

// Export
if (typeof window !== 'undefined') {
  window.FloatingBall = FloatingBall;
}
