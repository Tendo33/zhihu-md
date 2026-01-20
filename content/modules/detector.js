/**
 * Page Type Detector Module
 * Detects the type of Zhihu page (column, answer, question, home, follow, hot)
 */

const PageDetector = {
  /**
   * Detect page type based on URL pathname
   * @returns {'column'|'answer'|'question'|'hot'|'follow'|'home'|null}
   */
  detectPageType() {
    const pathname = window.location.pathname;
    
    if (pathname.startsWith('/p/')) {
      return 'column';
    }
    if (pathname.includes('/question/') && pathname.includes('/answer/')) {
      return 'answer';
    }
    if (pathname.includes('/question/') && !pathname.includes('/answer/')) {
      return 'question';
    }
    if (pathname === '/hot' || pathname === '/hot/') {
      return 'hot';
    }
    if (pathname === '/follow' || pathname === '/follow/') {
      return 'follow';
    }
    if (pathname === '/' || pathname === '') {
      return 'home';
    }
    
    return null;
  },

  /**
   * Check if current page is a valid article page
   * @returns {boolean}
   */
  isValidArticlePage() {
    return this.detectPageType() !== null;
  },

  /**
   * Check page type from URL (for popup use)
   * @param {string} url 
   * @returns {Object} Page type flags
   */
  checkUrlType(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      return {
        isZhihu: urlObj.hostname.endsWith('zhihu.com'),
        isColumn: pathname.startsWith('/p/'),
        isAnswer: pathname.includes('/question/') && pathname.includes('/answer/'),
        isQuestion: pathname.includes('/question/') && !pathname.includes('/answer/'),
        isHome: pathname === '/' || pathname === '',
        isFollow: pathname === '/follow' || pathname === '/follow/',
        isHot: pathname === '/hot' || pathname === '/hot/'
      };
    } catch {
      return { isZhihu: false };
    }
  }
};

// Export for different module systems
if (typeof window !== 'undefined') {
  window.PageDetector = PageDetector;
}
