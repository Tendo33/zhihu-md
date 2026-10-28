/**
 * Helpers for the Zhihu DOM that the extension actually sees.
 * Kept free of chrome.* so the fixtures can run in Node.
 */

import { normalizeUrl } from './constants.js';

export function cleanText(node) {
  return String(node?.textContent || '')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function yamlQuote(value) {
  const text = String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
  return `"${text}"`;
}

/**
 * Absolute stamps keep the clock and drop the location.
 * Relative labels such as 昨天 stay as text so the time line is not blank.
 */
export function parseZhihuTime(text) {
  const source = String(text || '')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const created = source.match(/发布于\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);
  const edited = source.match(/编辑于\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);
  const join = (match) => {
    if (!match) return '';
    return match[2] ? `${match[1]} ${match[2]}` : match[1];
  };
  const createdTime = join(created);
  const editedTime = join(edited);
  if (createdTime || editedTime) return { createdTime, editedTime };
  const fallback = source
    .replace(/\s*[・·]\s*\S.*$/, '')
    .replace(/\s+IP\s*属地.*$/, '')
    .replace(/^发布于\s*/, '')
    .trim();
  return { createdTime: fallback, editedTime: '' };
}

export function formatUnixTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return '';
  // The site prints China time. The browser zone would disagree with the page.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')} ${hour}:${pick('minute')}`;
}

/**
 * The avatar link is an empty a.UserLink-link and comes before the name.
 * A combined querySelector would return that empty link.
 */
export function findAuthorName(root) {
  if (!root) return '';
  const named = cleanText(root.querySelector('.AuthorInfo-name'));
  if (named) return named;
  const link = [...root.querySelectorAll('a.UserLink-link, .AuthorInfo a')].find((el) => cleanText(el));
  return cleanText(link);
}

function digits(value) {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? text : '';
}

function answerIdFromHref(href) {
  return String(href || '').match(/\/answer\/(\d+)/)?.[1] || '';
}

function answerIdFromScope(scope) {
  if (!scope?.querySelectorAll) return '';
  for (const anchor of scope.querySelectorAll('a[href*="/answer/"]')) {
    const id = answerIdFromHref(anchor.getAttribute('href'));
    if (id) return id;
  }
  return '';
}

function answerIdFromZop(raw) {
  if (!raw) return '';
  try {
    return digits(JSON.parse(raw)?.itemId);
  } catch {
    return '';
  }
}

export function answerIdFromItem(item) {
  if (!item) return '';
  const named = digits(item.getAttribute?.('name'))
    || digits(item.getAttribute?.('data-za-detail-view-id'))
    || answerIdFromZop(item.getAttribute?.('data-zop'));
  if (named) return named;
  const timed = answerIdFromScope(item.querySelector?.('.ContentItem-time'));
  if (timed) return timed;
  const action = answerIdFromScope(item.querySelector?.('.ContentItem-actions'));
  if (action) return action;
  if (!item.querySelectorAll) return '';
  for (const anchor of item.querySelectorAll('a[href*="/answer/"]')) {
    if (anchor.closest?.('.RichText, .RichContent-inner')) continue;
    const id = answerIdFromHref(anchor.getAttribute('href'));
    if (id) return id;
  }
  return '';
}

export function findAnswerItem(root, answerId) {
  if (!root) return null;
  if (answerId) {
    const byName = root.querySelector(`[name="${answerId}"]`);
    if (byName) return byName.closest?.('.AnswerItem') || byName;
    const byLink = [...root.querySelectorAll('.AnswerItem')].find((item) => answerIdFromItem(item) === answerId);
    if (byLink) return byLink;
    return root.querySelector(`[data-za-detail-view-id="${answerId}"]`);
  }
  return root.querySelector('.AnswerItem');
}

export function findExpandButton(root) {
  if (!root) return null;
  return [...root.querySelectorAll('button')].find((button) => {
    const text = (button.textContent || '').replace(/\s+/g, '');
    if (!text || text.includes('收起') || text.includes('评论')) return false;
    return text.includes('阅读全文') || text.includes('显示全部') || text.includes('展开');
  }) || null;
}

export function findFeedTitle(root) {
  const metaName = root.querySelector('.ContentItem-title meta[itemprop="name"], h2 meta[itemprop="name"]')?.getAttribute('content')?.trim();
  if (metaName) return metaName;
  const link = [...root.querySelectorAll('.ContentItem-title a, h2 a')].find((anchor) => {
    const text = cleanText(anchor);
    return text && text !== '直达问题';
  });
  if (link) return cleanText(link);
  const titled = root.querySelector('a[title][href*="/question/"], a[title][href*="/p/"], a[title][href*="/pin/"]');
  const title = titled?.getAttribute('title')?.trim();
  if (title) return title;
  return cleanText(root.querySelector('.ContentItem-title, h2')).replace(/直达问题$/, '').trim();
}

function linkOutsideBody(root, pattern) {
  return [...root.querySelectorAll('a[href]')].find((anchor) => {
    if (anchor.closest('.RichText, .RichContent-inner')) return false;
    return pattern.test(anchor.getAttribute('href') || '');
  }) || null;
}

export function findFeedTimeText(root) {
  if (!root) return '';
  const stamped = [...root.querySelectorAll('.ContentItem-time')].map((node) => cleanText(node)).find(Boolean);
  if (stamped) return stamped;
  const sourceLines = [...root.querySelectorAll('.FeedSource-firstline')];
  for (const line of sourceLines) {
    const direct = [...line.childNodes].map((node) => timeStamp(cleanText(node))).find(Boolean);
    if (direct) return direct;
    const mixed = timeStamp(cleanText(line));
    if (mixed) return mixed;
  }
  return '';
}

function timeStamp(text) {
  if (!text) return '';
  const match = text.match(/(刚刚|\d+\s*分钟前|\d+\s*小时前|\d+\s*天前|昨天(?:\s*\d{2}:\d{2})?|\d{4}-\d{2}-\d{2}(?:\s*\d{2}:\d{2})?)/);
  if (!match) return '';
  return match[1].replace(/\s+/g, ' ');
}

export function findFeedLink(root) {
  if (!root) return null;
  const titleLink = [...root.querySelectorAll('.ContentItem-title a[href], h2 a[href], a.ContentItem-title[href]')].find((anchor) => {
    const text = cleanText(anchor);
    return text && text !== '直达问题';
  });
  if (titleLink) return titleLink;
  return linkOutsideBody(root, /\/answer\//)
    || linkOutsideBody(root, /\/p\//)
    || linkOutsideBody(root, /\/pin\//)
    || linkOutsideBody(root, /\/question\//);
}

function isZhihuHttpsUrl(value) {
  try {
    const parsed = new URL(value, 'https://www.zhihu.com');
    return parsed.protocol === 'https:' && /(^|\.)zhihu\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function hotMetrics(item) {
  const metricsEl = item.querySelector('.HotItem-metrics');
  if (!metricsEl) return '';
  const clone = metricsEl.cloneNode(true);
  clone.querySelectorAll('button, a').forEach((el) => el.remove());
  return cleanText(clone).replace(/\u200b|\u200c|\u200d|\ufeff/g, '').replace(/分享/g, '').trim();
}

export function extractHotItem(item, index) {
  const titleEl = item.querySelector('.HotItem-title, h2');
  const linkEl = item.querySelector('a[href*="/question/"]') || item.querySelector('a[href]');
  const title = cleanText(titleEl) || linkEl?.getAttribute('title')?.trim() || '';
  const rank = cleanText(item.querySelector('.HotItem-rank')) || String(index + 1);
  return {
    rank,
    title,
    url: normalizeUrl(linkEl?.getAttribute('href') || ''),
    metrics: hotMetrics(item),
  };
}

export function extractHotItems(root) {
  const sections = [...root.querySelectorAll('.HotItem')].filter((el) => !el.parentElement?.closest('.HotItem'));
  const items = [];
  const seen = new Set();
  sections.forEach((section, index) => {
    const item = extractHotItem(section, items.length || index);
    const key = item.url || item.title;
    if (!item.title || !key || seen.has(key)) return;
    seen.add(key);
    item.rank = cleanText(section.querySelector('.HotItem-rank')) || String(items.length + 1);
    items.push(item);
  });
  return items;
}

export function extractHotFallback(root) {
  const items = [];
  const seen = new Set();
  for (const link of root.querySelectorAll('a[href*="/question/"]')) {
    const url = normalizeUrl(link.getAttribute('href') || '');
    if (!url || seen.has(url)) continue;
    const title = link.getAttribute('title')?.trim() || cleanText(link.querySelector('h2, .HotItem-title'));
    if (!title || title.length < 4) continue;
    seen.add(url);
    items.push({ rank: String(items.length + 1), title, url, metrics: '' });
  }
  return items;
}

const FEED_INCLUDE = 'data[*].content,excerpt,author,created_time,updated_time,id,content_need_truncated';

/**
 * Question pages render the first screen only. Scrolling the window does not
 * append the rest; the next page is paging.next on /api/v4/questions/{id}/feeds.
 */
export async function pageQuestionFeeds({ questionId, targetCount, fetchImpl = fetch }) {
  const include = encodeURIComponent(FEED_INCLUDE);
  let url = `https://www.zhihu.com/api/v4/questions/${questionId}/feeds?limit=20&offset=0&order=default&platform=desktop&include=${include}`;
  const rows = [];
  const seen = new Set();
  const seenUrls = new Set();
  let pages = 0;
  let isEnd = false;

  while (rows.length < targetCount && url && pages < 60) {
    if (!isZhihuHttpsUrl(url) || seenUrls.has(url)) break;
    seenUrls.add(url);
    pages += 1;
    let response;
    try {
      response = await fetchImpl(url, { credentials: 'include' });
    } catch {
      break;
    }
    if (!response?.ok || typeof response.json !== 'function') break;
    let json;
    try {
      json = await response.json();
    } catch {
      break;
    }
    if (!json || typeof json !== 'object') break;
    for (const row of json.data || []) {
      const target = row?.target;
      if (!target?.id) continue;
      const id = String(target.id);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(target);
      if (rows.length >= targetCount) break;
    }
    const next = json.paging?.next;
    if (json.paging?.is_end || !next) {
      isEnd = true;
      break;
    }
    if (!isZhihuHttpsUrl(next)) break;
    url = next;
  }
  return { rows, isEnd };
}

export async function fetchAnswerRecord(answerId, fetchImpl = fetch) {
  if (!answerId) return null;
  try {
    const response = await fetchImpl(
      `https://www.zhihu.com/api/v4/answers/${answerId}?include=content,excerpt,author,created_time,updated_time`,
      { credentials: 'include' }
    );
    if (!response?.ok) return null;
    const json = await response.json();
    if (!json || json.error || !json.content) return null;
    return json;
  } catch {
    return null;
  }
}
