import assert from 'assert';
import { parseHTML } from 'linkedom';
import { createTurndownService } from '../content/modules/turndown-rules.js';
import { QuestionExporter } from '../content/modules/exporters/question.js';
import { FeedExporter } from '../content/modules/exporters/feed.js';
import {
  answerIdFromItem,
  extractHotItems,
  extractHotFallback,
  findAnswerItem,
  findAuthorName,
  findExpandButton,
  findFeedLink,
  findFeedTimeText,
  findFeedTitle,
  formatUnixTime,
  pageQuestionFeeds,
  parseZhihuTime,
} from '../content/modules/zhihu-dom.js';

const dom = parseHTML(`<!doctype html><html><body>
<section class="HotItem">
  <div class="HotItem-index"><div class="HotItem-rank">1</div></div>
  <div class="HotItem-content">
    <a href="https://www.zhihu.com/question/1" title="短标题">
      <h2 class="HotItem-title">短标题</h2>
      <p class="HotItem-excerpt">这是一段不该进入标题的摘要</p>
    </a>
    <div class="HotItem-metrics">1229 万热度&#8203;分享</div>
  </div>
</section>
<section class="HotItem">
  <div class="HotItem-rank">2</div>
  <div class="HotItem-content">
    <a href="https://www.zhihu.com/question/1" title="短标题"><h2 class="HotItem-title">短标题</h2></a>
  </div>
</section>
<div class="AnswerItem" name="200">
  <a class="UserLink-link" href="/people/a"></a>
  <span class="UserLink AuthorInfo-name">自研王</span>
  <div class="ContentItem-time">发布于2026-10-09 20:08</div>
  <div class="RichText ztext"><p>第一条</p></div>
</div>
<div class="AnswerItem" name="100">
  <a class="UserLink-link" href="/people/b"></a>
  <span class="AuthorInfo-name">阿汪</span>
  <div class="RichText ztext"><p>目标回答</p></div>
</div>
<div class="TopstoryItem">
  <button class="Button Button--plain">添加评论</button>
  <button class="Button ContentItem-more Button--plain">阅读全文</button>
  <h2 class="ContentItem-title">
    <meta itemprop="name" content="人到中年，为什么对许多事没了兴趣？">
    <a href="/question/1/answer/2">人到中年，为什么对许多事没了兴趣？</a>
    <a href="/question/1">直达问题</a>
  </h2>
</div>
<div class="AnswerItem" id="cited">
  <div class="RichText ztext"><a href="/question/1/answer/999">引用别人的回答</a></div>
  <div class="ContentItem-time"><a href="/question/9/answer/400">发布于 昨天 18:20</a></div>
</div>
<div class="AnswerItem" id="zop" data-zop='{"itemId":"300","type":"answer"}'>
  <div class="RichText ztext"><a href="/question/1/answer/999">引用</a></div>
</div>
<div class="TopstoryItem" id="column-card">
  <h2 class="ContentItem-title"><a href="/p/55">专栏</a></h2>
  <div class="RichText"><a href="/question/1/answer/2">引用回答</a></div>
</div>
<div class="TopstoryItem" id="pin-card">
  <div class="RichText"><a href="/question/1/answer/2">引用</a></div>
  <a href="/pin/77">想法</a>
</div>
<div class="TopstoryItem" id="bare-card">
  <div class="RichText">只有正文</div>
</div>
<div class="AnswerItem" name="7">
  <div class="RichText ztext"><p>完整回答正文</p><video src="https://www.zhihu.com/video.mp4"></video></div>
</div>
<div class="AnswerItem" name="8">
  <div class="RichText ztext"><p>短</p></div>
</div>
</body></html>`);

const hot = extractHotItems(dom.document);
assert.strictEqual(hot.length, 1);
assert.strictEqual(hot[0].title, '短标题');
assert.strictEqual(hot[0].rank, '1');
assert.strictEqual(hot[0].metrics, '1229 万热度');
assert.ok(!hot[0].title.includes('摘要'));

const fallback = extractHotFallback(parseHTML(`<!doctype html><body>
  <a href="/question/9" title="只要标题">标题加上一大段摘要</a>
</body>`).document);
assert.strictEqual(fallback[0].title, '只要标题');

assert.strictEqual(findAuthorName(dom.document.querySelector('.AnswerItem')), '自研王');
const target = findAnswerItem(dom.document, '100');
assert.strictEqual(findAuthorName(target), '阿汪');
assert.strictEqual(target.querySelector('.RichText').textContent.trim(), '目标回答');

const card = dom.document.querySelector('.TopstoryItem');
assert.strictEqual(findExpandButton(card).textContent.trim(), '阅读全文');
assert.strictEqual(findFeedTitle(card), '人到中年，为什么对许多事没了兴趣？');

assert.deepStrictEqual(
  parseZhihuTime('发布于 2026-10-10 00:18・广东'),
  { createdTime: '2026-10-10 00:18', editedTime: '' }
);
assert.deepStrictEqual(
  parseZhihuTime('发布于2026-10-09 18:26 ，编辑于2026-10-09 19:06 创建于: 2026-10-09 18:26:43'),
  { createdTime: '2026-10-09 18:26', editedTime: '2026-10-09 19:06' }
);
assert.deepStrictEqual(
  parseZhihuTime('发布于 昨天 18:20・广东'),
  { createdTime: '昨天 18:20', editedTime: '' }
);
assert.deepStrictEqual(parseZhihuTime('3 小时前・广东'), { createdTime: '3 小时前', editedTime: '' });
assert.deepStrictEqual(parseZhihuTime('刚刚'), { createdTime: '刚刚', editedTime: '' });

assert.strictEqual(formatUnixTime(1791547723), '2026-10-09 20:08');
assert.strictEqual(answerIdFromItem(dom.document.querySelector('#cited')), '400');
assert.strictEqual(answerIdFromItem(dom.document.querySelector('#zop')), '300');
assert.strictEqual(findFeedLink(card).getAttribute('href'), '/question/1/answer/2');
assert.strictEqual(findFeedLink(dom.document.querySelector('#column-card')).getAttribute('href'), '/p/55');
assert.strictEqual(findFeedLink(dom.document.querySelector('#pin-card')).getAttribute('href'), '/pin/77');
assert.strictEqual(findFeedLink(dom.document.querySelector('#bare-card')), null);
const timeCard = parseHTML(`<!doctype html><body>
  <div class="TopstoryItem" id="sourced">
    <div class="FeedSource-firstline">专栏 · 3 小时前</div>
  </div>
  <div class="TopstoryItem" id="stamped">
    <div class="FeedSource-firstline">3 小时前</div>
    <div class="ContentItem-time">发布于 2026-10-10 00:18・广东</div>
  </div>
</body>`).document;
assert.strictEqual(findFeedTimeText(timeCard.querySelector('#sourced')), '3 小时前');
assert.strictEqual(findFeedTimeText(timeCard.querySelector('#stamped')), '发布于 2026-10-10 00:18・广东');

let calls = 0;
const pages = [
  {
    data: [
      { target: { id: 1, content: '<p>a</p>' } },
      { target: { id: 1, content: '<p>dup</p>' } },
    ],
    paging: { is_end: false, next: 'https://www.zhihu.com/api/next' },
  },
  {
    data: [{ target: { id: 2, content: '<p>b</p>' } }],
    paging: { is_end: true },
  },
];
const rows = await pageQuestionFeeds({
  questionId: '9',
  targetCount: 10,
  fetchImpl: async () => ({ ok: true, json: async () => pages[calls++] }),
});
assert.deepStrictEqual(rows.rows.map((row) => row.id), [1, 2]);
assert.strictEqual(rows.isEnd, true);
assert.strictEqual(calls, 2);

let offsiteCalls = 0;
const offsite = await pageQuestionFeeds({
  questionId: '9',
  targetCount: 10,
  fetchImpl: async (url) => {
    offsiteCalls += 1;
    if (String(url).includes('evil')) throw new Error('offsite next was fetched');
    return {
      ok: true,
      json: async () => ({
        data: [{ target: { id: 1, content: '<p>a</p>' } }],
        paging: { is_end: false, next: 'https://evil.example/steal' },
      }),
    };
  },
});
assert.deepStrictEqual(offsite.rows.map((row) => row.id), [1]);
assert.strictEqual(offsite.isEnd, false);
assert.strictEqual(offsiteCalls, 1);

let brokenPages = 0;
const broken = await pageQuestionFeeds({
  questionId: '9',
  targetCount: 10,
  fetchImpl: async () => ({
    ok: true,
    json: async () => {
      brokenPages += 1;
      if (brokenPages === 1) {
        return {
          data: [{ target: { id: 4, content: '<p>kept</p>' } }],
          paging: { is_end: false, next: 'https://www.zhihu.com/api/v4/questions/9/feeds?offset=20' },
        };
      }
      throw new SyntaxError('not json');
    },
  }),
});
assert.deepStrictEqual(broken.rows.map((row) => row.id), [4]);
assert.strictEqual(broken.isEnd, false);
assert.strictEqual(brokenPages, 2);

let repeatedCalls = 0;
const repeated = await pageQuestionFeeds({
  questionId: '9',
  targetCount: 10,
  fetchImpl: async () => {
    repeatedCalls += 1;
    return {
      ok: true,
      json: async () => ({
        data: [{ target: { id: repeatedCalls, content: '<p>a</p>' } }],
        paging: { is_end: false, next: 'https://www.zhihu.com/api/v4/questions/9/feeds?cursor=same' },
      }),
    };
  },
});
assert.strictEqual(repeatedCalls, 2);
assert.deepStrictEqual(repeated.rows.map((row) => row.id), [1, 2]);
assert.strictEqual(repeated.isEnd, false);

globalThis.window = dom.window;
globalThis.document = dom.document;
globalThis.fetch = async () => { throw new Error('offline'); };
const turndown = createTurndownService(false);
const fullDom = QuestionExporter.readAnswer(dom.document.querySelector('[name="7"]'));
const shortDom = QuestionExporter.readAnswer(dom.document.querySelector('[name="8"]'));
const withVideo = await QuestionExporter.recordFromFeed(
  { id: 7, content: '<p>完整回答正文</p>' },
  '1',
  turndown,
  new Map([['7', fullDom]])
);
assert.match(withVideo.content, /video\.mp4/);
const replaced = await QuestionExporter.recordFromFeed(
  { id: 8, content: `<p>${'长'.repeat(30)}</p>` },
  '1',
  turndown,
  new Map([['8', shortDom]])
);
assert.match(replaced.content, /长{30}/);
assert.doesNotMatch(replaced.content, /短/);
const excerpted = await QuestionExporter.recordFromFeed(
  { id: 11, excerpt: 'a < b & c' },
  '1',
  turndown,
  new Map()
);
assert.match(excerpted.content, /a < b & c/);
assert.doesNotMatch(excerpted.content, /<b/);

const feedDom = parseHTML(`<!doctype html><html><body>
<div class="TopstoryItem">
  <span class="AuthorInfo-name">作者甲</span>
  <div class="ContentItem-time">发布于 昨天 18:20・广东</div>
  <h2 class="ContentItem-title"><a href="/p/55">专栏</a></h2>
  <div class="RichText"><p>专栏正文</p><a href="/question/1/answer/2">引用回答</a></div>
</div>
<div class="TopstoryItem">
  <span class="AuthorInfo-name">作者乙</span>
  <div class="ContentItem-time">刚刚</div>
  <div class="RichText"><p>只有想法正文</p></div>
</div>
</body></html>`);
globalThis.window = feedDom.window;
globalThis.document = feedDom.document;
feedDom.window.scrollTo = () => {};
Object.defineProperty(feedDom.window, 'location', {
  configurable: true,
  value: { href: 'https://www.zhihu.com/follow' },
});
globalThis.chrome = { storage: { sync: { get: (_defaults, done) => done({ maxAnswerCount: 2 }) } } };
const feed = await FeedExporter.exportFeedItems('follow');
assert.strictEqual(feed.success, true);
assert.match(feed.data.content, /\[查看原文\]\(https:\/\/www\.zhihu\.com\/p\/55\)/);
assert.match(feed.data.content, /发布于 昨天 18:20/);
assert.match(feed.data.content, /发布于 刚刚/);
assert.strictEqual((feed.data.content.match(/查看原文/g) || []).length, 1);
assert.doesNotMatch(feed.data.content, /\[查看原文\]\(\)/);

const questionDom = parseHTML(`<!doctype html><html><body>
<h4 class="List-headerText">358 个回答</h4>
<div class="AnswerItem" name="7"><span class="AuthorInfo-name">甲</span><div class="RichText ztext"><p>页面回答甲</p></div></div>
<div class="AnswerItem" name="8"><span class="AuthorInfo-name">乙</span><div class="RichText ztext"><p>页面回答乙</p></div></div>
<div class="AnswerItem" name="9"><span class="AuthorInfo-name">丙</span><div class="RichText ztext"><p>页面回答丙</p></div></div>
</body></html>`);
globalThis.window = questionDom.window;
globalThis.document = questionDom.document;
questionDom.window.scrollTo = () => {};
Object.defineProperty(questionDom.window, 'location', {
  configurable: true,
  value: { href: 'https://www.zhihu.com/question/9', pathname: '/question/9' },
});
globalThis.chrome = { storage: { sync: { get: (_defaults, done) => done({ maxAnswerCount: 2 }) } } };
globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('not json'); } });
const fromDom = await QuestionExporter.exportMultipleAnswers(false);
assert.strictEqual(fromDom.success, true);
assert.match(fromDom.data.content, /answer_count: 2/);
assert.match(fromDom.data.content, /truncated: true/);
assert.match(fromDom.data.content, /页面回答甲/);
assert.match(fromDom.data.content, /页面回答乙/);
assert.doesNotMatch(fromDom.data.content, /页面回答丙/);

let feedCalls = 0;
globalThis.chrome = { storage: { sync: { get: (_defaults, done) => done({ maxAnswerCount: 3 }) } } };
globalThis.fetch = async (url) => {
  if (!String(url).includes('/feeds')) throw new Error('offline');
  feedCalls += 1;
  if (feedCalls > 1) throw new Error('next page failed');
  return {
    ok: true,
    json: async () => ({
      data: [{ target: { id: 7, content: '<p>接口里的完整回答甲，比页面上留下的摘要更长</p>' } }],
      paging: { is_end: false, next: 'https://www.zhihu.com/api/v4/questions/9/feeds?offset=20' },
    }),
  };
};
const merged = await QuestionExporter.exportMultipleAnswers(false);
assert.strictEqual(merged.success, true);
assert.match(merged.data.content, /answer_count: 3/);
assert.match(merged.data.content, /truncated: true/);
assert.match(merged.data.content, /接口里的完整回答甲/);
assert.doesNotMatch(merged.data.content, /页面回答甲/);
assert.match(merged.data.content, /页面回答乙/);
assert.match(merged.data.content, /页面回答丙/);

globalThis.chrome = { storage: { sync: { get: (_defaults, done) => done({ maxAnswerCount: 20 }) } } };
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    data: [
      { target: { id: 7, content: '<p>完</p>' } },
      { target: { id: 8, content: '<p>完</p>' } },
      { target: { id: 9, content: '<p>完</p>' } },
    ],
    paging: { is_end: true },
  }),
});
const finished = await QuestionExporter.exportMultipleAnswers(false);
assert.strictEqual(finished.success, true);
assert.match(finished.data.content, /answer_count: 3/);
assert.doesNotMatch(finished.data.content, /truncated/);

console.log('zhihu dom fixture assertions passed');
