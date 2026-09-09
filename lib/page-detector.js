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

    // Zhihu serves both trailing-slash and extensionless routes. Normalize
    // duplicate slashes so SPA transitions cannot evade classification.
    pathname = String(pathname).replace(/\/+/g, '/');
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');

    if (/^\/p\/[^/]+/.test(pathname)) {
      return 'column';
    }
    if (pathname.includes('/question/') && pathname.includes('/answer/')) {
      return 'answer';
    }
    if (pathname.includes('/question/') && !pathname.includes('/answer/')) {
      return 'question';
    }
    if (pathname === '/hot') {
      return 'hot';
    }
    if (pathname === '/follow') {
      return 'follow';
    }
    if (pathname === '/') {
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
      const hostname = urlObj.hostname.toLowerCase();
      const isZhihu = hostname === 'zhihu.com' || hostname.endsWith('.zhihu.com');
      return {
        isZhihu,
        isColumn: isZhihu && /^\/p\/[^/]+/.test(pathname),
        isAnswer: isZhihu && /\/question\/[^/]+\/answer\/\d+/.test(pathname),
        isQuestion: isZhihu && /\/question\/[^/]+$/.test(pathname.replace(/\/+$/, '')),
        isHome: isZhihu && (pathname === '/' || pathname === ''),
        isFollow: isZhihu && pathname.replace(/\/+$/, '') === '/follow',
        isHot: isZhihu && pathname.replace(/\/+$/, '') === '/hot'
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
