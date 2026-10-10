/**
 * Detect page type from pathname.
 * @param {string} pathname
 * @returns {'column'|'answer'|'question'|'hot'|'follow'|'home'|null}
 */
export function detectPageTypeFromPathname(pathname) {
  if (!pathname && pathname !== '') return null;

  // Zhihu serves both trailing-slash and extensionless routes. Normalize
  // duplicate slashes so SPA transitions cannot evade classification.
  pathname = String(pathname).replace(/\/+/g, '/');
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');

  if (/^\/p\/[^/]+/.test(pathname)) {
    return 'column';
  }
  // Same boundaries as checkUrlType. A loose includes() treated
  // /question/123/log as a question and /answer/abc as an answer.
  if (/^\/question\/[^/]+\/answer\/\d+$/.test(pathname)) {
    return 'answer';
  }
  if (/^\/question\/[^/]+$/.test(pathname)) {
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
 * Check page type from a URL string.
 * @param {string} url
 * @returns {Object} Page type flags
 */
export function checkUrlType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const isZhihu = hostname === 'zhihu.com' || hostname.endsWith('.zhihu.com');
    const pageType = isZhihu ? detectPageTypeFromPathname(urlObj.pathname) : null;
    return {
      isZhihu,
      isColumn: pageType === 'column',
      isAnswer: pageType === 'answer',
      isQuestion: pageType === 'question',
      isHome: pageType === 'home',
      isFollow: pageType === 'follow',
      isHot: pageType === 'hot'
    };
  } catch {
    return { isZhihu: false };
  }
}
