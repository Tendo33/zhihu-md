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

      const maxLeft = window.innerWidth - ballWidth;
      const maxTop = window.innerHeight - ballHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

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

      const maxLeft = window.innerWidth - ballWidth;
      const maxTop = window.innerHeight - ballHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

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

          const ballWidth = ball.offsetWidth || 44;
          const ballHeight = ball.offsetHeight || 44;
          const maxLeft = window.innerWidth - ballWidth;
          const maxTop = window.innerHeight - ballHeight;

          let validX = Math.max(0, Math.min(x, maxLeft));
          let validY = Math.max(0, Math.min(y, maxTop));

          ball.style.right = 'auto';
          ball.style.bottom = 'auto';
          ball.style.left = `${validX}px`;
          ball.style.top = `${validY}px`;

          const dockThreshold = 5;
          if (validX <= dockThreshold) {
            setTimeout(() => ball.classList.add('docked-left'), 800);
          } else if (validX >= window.innerWidth - ballWidth - dockThreshold) {
            setTimeout(() => ball.classList.add('docked-right'), 800);
          }
        }
      });
    }
  },
};
