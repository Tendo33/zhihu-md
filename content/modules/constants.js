/**
 * Constants Module
 * Shared constants and selectors for content scripts
 */

const CONSTANTS = {
  SELECTORS: {
    COLUMN_CONTAINER: ['.Post-RichText', '.RichText.ztext.Post-RichText'],
    ANSWER_CONTAINER: ['.AnswerItem .RichText', '[data-za-detail-view-id="{id}"]'],
    TITLE: {
      COLUMN: ['.Post-Title', 'h1.Post-Title'],
      ANSWER: ['.QuestionHeader-title']
    },
    AUTHOR: {
      COLUMN: ['.AuthorInfo-name', '.UserLink-link'],
      ANSWER: ['.AnswerItem .AuthorInfo-name', '.AnswerItem .UserLink-link']
    },
    UNWANTED: [
      '.ContentItem-actions',    // Action buttons
      '.RichText-ADLinkCardContainer', // Ad cards
      '.AdblockBanner',          // Adblock banners
      '.Reward',                 // Reward/tip section
      '.Post-topicsAndReviewer', // Topics section
      '.FollowButton',           // Follow buttons
      '.Question-sideColumn',    // Side column
      '.CornerButtons'           // Floating buttons
    ]
  },

  // Default settings
  DEFAULTS: {
    MAX_ANSWER_COUNT: 20,
    SCROLL_TIMEOUT: 30000,
    SCROLL_INTERVAL: 1000
  }
};

/**
 * Helper to find element by multiple selectors
 * @param {Element} parent 
 * @param {string[]} selectors 
 * @returns {Element|null}
 */
function querySelectorAny(parent, selectors) {
  for (const selector of selectors) {
    const el = parent.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Clean filename - remove illegal characters
 * @param {string} title 
 * @returns {string}
 */
function cleanFilename(title) {
  return title
    .replace(/[/\\:*?"<>|]/g, '_')  // Replace illegal chars
    .replace(/\s+/g, '_')            // Replace spaces
    .replace(/_+/g, '_')             // Collapse multiple underscores
    .replace(/^_|_$/g, '')           // Trim underscores
    .substring(0, 100);              // Limit length
}

/**
 * Normalize URL to full URL format
 * @param {string} href 
 * @returns {string}
 */
function normalizeUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `https://www.zhihu.com${href}`;
  return `https://www.zhihu.com/${href}`;
}

// Export for different module systems
if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
  window.querySelectorAny = querySelectorAny;
  window.cleanFilename = cleanFilename;
  window.normalizeUrl = normalizeUrl;
}
