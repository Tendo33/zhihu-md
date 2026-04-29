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
    return window.PageTypeUtils.detectPageTypeFromPathname(window.location.pathname);
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
    return window.PageTypeUtils.checkUrlType(url);
  }
};

// Export for different module systems
if (typeof window !== 'undefined') {
  window.PageDetector = PageDetector;
}
