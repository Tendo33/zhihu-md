/**
 * Page Detector Utilities
 * Shared logic for identifying Zhihu page types
 */

(function() {
  'use strict';

  /**
   * Detect page type from pathname
   * @param {string} pathname
   * @returns {'column'|'answer'|'question'|'hot'|'follow'|'home'|null}
   */
  function detectPageTypeFromPathname(pathname) {
    if (!pathname && pathname !== '') return null;

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
  }

  /**
   * Check page type from URL string
   * @param {string} url
   * @returns {Object} Page type flags
   */
  function checkUrlType(url) {
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

  if (typeof window !== 'undefined') {
    window.PageTypeUtils = {
      detectPageTypeFromPathname,
      checkUrlType
    };
  }
})();
