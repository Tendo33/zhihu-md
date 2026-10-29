/**
 * QA e2fa5da P4：恢复位置时夹到视口内（QA 在 1280 左上角看到 -12,-12）。
 * 存储里的值可能是负数、超出当前窗口或不是数字；窗口比球还小时贴在 0。
 */
/** 设计验收 2026-10-29 必改 1：球离可见视口四边至少留 4px（焦点环 offset 2px + 线宽 2px），环不被裁 */
export const BALL_EDGE_GAP = 4;
export function clampBallPosition(x, y, w, h, vw, vh) {
  const fix = (v, max) => {
    const n = Number(v);
    // 窗口连 球+两边 4px 都放不下时退回 [0, max]，不出现负数
    const lo = max - BALL_EDGE_GAP >= BALL_EDGE_GAP ? BALL_EDGE_GAP : 0;
    const hi = lo ? max - BALL_EDGE_GAP : Math.max(0, max);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(n, hi));
  };
  return { x: fix(x, vw - w), y: fix(y, vh - h) };
}

/**
 * 审查 a833a13 P3-2：存储的 x/y 只有是有限数（或能转成有限数的非空字符串）才恢复；
 * 否则保持默认位置，不要落到 0,0 再吸左。
 */
export function isStoredCoord(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  // 审查 a9bbc6e P4：字符串只接受十进制（可带负号、小数、首尾空白）；'0x10'、'1e2'、'Infinity' 不算
  if (typeof v === 'string') return /^\s*-?\d+(\.\d+)?\s*$/.test(v);
  return false;
}

/**
 * 审查 a9bbc6e P3 / 设计 R12：可见视口用 documentElement.clientWidth/clientHeight（不含滚动条），
 * 和 CSS `right:0` 的落点一致；取不到时退回 innerWidth/innerHeight。
 */
export function viewportSize() {
  const de = typeof document !== 'undefined' ? document.documentElement : null;
  return { vw: (de && de.clientWidth) || window.innerWidth, vh: (de && de.clientHeight) || window.innerHeight };
}

export const floatingBallDrag = {
  /**
   * Initialize drag functionality
   * @param {HTMLElement} ball 
   * @returns {Function} checkHasMoved function
   */
  initDrag(ball) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let ballWidth = 0;
    let ballHeight = 0;
    let hasMoved = false;
    let dockTimeout;
    let rafId = null;
    let latestLeft = 0;
    let latestTop = 0;

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
      ballWidth = rect.width || ball.offsetWidth;
      ballHeight = rect.height || ball.offsetHeight;

      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
      ball.style.left = `${initialLeft}px`;
      ball.style.top = `${initialTop}px`;

      e.preventDefault();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const scheduleMove = (newLeft, newTop) => {
      latestLeft = newLeft;
      latestTop = newTop;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        ball.style.left = `${latestLeft}px`;
        ball.style.top = `${latestTop}px`;
      });
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

      const { vw, vh } = viewportSize();
      ({ x: newLeft, y: newTop } = clampBallPosition(newLeft, newTop, ballWidth, ballHeight, vw, vh));

      scheduleMove(newLeft, newTop);
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      ball.classList.remove('dragging');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (hasMoved) {
        this.handleSnapAndDock(ball);
        setTimeout(() => {
          hasMoved = false;
        }, 0);
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
      ballWidth = rect.width || ball.offsetWidth;
      ballHeight = rect.height || ball.offsetHeight;

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

      const { vw, vh } = viewportSize();
      ({ x: newLeft, y: newTop } = clampBallPosition(newLeft, newTop, ballWidth, ballHeight, vw, vh));

      scheduleMove(newLeft, newTop);
    };

    const onTouchEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      ball.classList.remove('dragging');
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (hasMoved) {
        this.handleSnapAndDock(ball);
        setTimeout(() => {
          hasMoved = false;
        }, 0);
      }
    };

    ball.addEventListener('mouseenter', clearDockedState);

    ball.addEventListener('mouseleave', () => {
      if (!isDragging) {
        const rect = ball.getBoundingClientRect();
        const winWidth = viewportSize().vw;
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
    const winWidth = viewportSize().vw;

    this.savePosition(rect.left, rect.top);

    const docThreshold = 30;
    let dockedSide = null;

    if (rect.left < docThreshold) {
      // 吸边也离边 4px（收边后 CSS left:0/right:0 + translate 接管，静止收边位置不变）
      ball.style.left = `${BALL_EDGE_GAP}px`;
      this.savePosition(BALL_EDGE_GAP, rect.top);
      dockedSide = 'left';
    } else if (winWidth - rect.right < docThreshold) {
      ball.style.left = `${winWidth - rect.width - BALL_EDGE_GAP}px`;
      this.savePosition(winWidth - rect.width - BALL_EDGE_GAP, rect.top);
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
  /** QA e2fa5da P4：窗口缩放后，已经设过 left/top 的球拉回视口内 */
  clampToViewport(ball) {
    if (!ball || !ball.style.left || ball.style.left === 'auto') return;
    const w = ball.offsetWidth || 44;
    const h = ball.offsetHeight || 44;
    const { vw, vh } = viewportSize();
    const { x, y } = clampBallPosition(parseFloat(ball.style.left), parseFloat(ball.style.top), w, h, vw, vh);
    ball.style.left = `${x}px`;
    ball.style.top = `${y}px`;
  },

  restorePosition(ball) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['floatingBallPosition'], (result) => {
        if (result.floatingBallPosition) {
          const { x, y } = result.floatingBallPosition;
          if (!isStoredCoord(x) || !isStoredCoord(y)) return;

          const ballWidth = ball.offsetWidth || 44;
          const ballHeight = ball.offsetHeight || 44;
          const { vw, vh } = viewportSize();
          const { x: validX, y: validY } = clampBallPosition(x, y, ballWidth, ballHeight, vw, vh);

          ball.style.right = 'auto';
          ball.style.bottom = 'auto';
          ball.style.left = `${validX}px`;
          ball.style.top = `${validY}px`;

          const dockThreshold = 5;
          if (validX <= dockThreshold) {
            setTimeout(() => ball.classList.add('docked-left'), 800);
          } else if (validX >= vw - ballWidth - dockThreshold) {
            setTimeout(() => ball.classList.add('docked-right'), 800);
          }
        }
      });
    }
  },
};
