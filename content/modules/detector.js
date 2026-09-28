/**
 * Page Type Detector Module
 * Detects the type of Zhihu page (column, answer, question, home, follow, hot)
 */

import { checkUrlType, detectPageTypeFromPathname } from '../../lib/page-detector.js';

export const PageDetector = {
  /**
   * Detect page type based on URL pathname
   * @returns {'column'|'answer'|'question'|'hot'|'follow'|'home'|null}
   */
  detectPageType() {
    return detectPageTypeFromPathname(window.location.pathname);
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
    return checkUrlType(url);
  }
};

