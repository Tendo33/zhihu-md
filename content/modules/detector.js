/**
 * Page Type Detector Module
 * Detects the type of Zhihu page (column, answer, question, home, follow, hot)
 */

import { checkUrlType, detectPageTypeFromPathname, hasExportableContent } from '../../lib/page-detector.js';

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
   * Whether the current page rendered exportable content (not an error/verification page)
   * @returns {boolean}
   */
  hasContent() {
    return hasExportableContent(document, this.detectPageType());
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

