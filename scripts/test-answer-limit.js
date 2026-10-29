// 「最大下载回答数」上限 1000：保存路径（options）和使用路径（问题页 / 动态页导出）都截到 1000
import assert from 'assert';
import fs from 'fs';
import { parseHTML } from 'linkedom';
import { capAnswerCount, MAX_ANSWER_LIMIT } from '../lib/answer-limit.js';

assert.strictEqual(MAX_ANSWER_LIMIT, 1000);
for (const [v, want] of [[NaN, NaN], [null, null], [undefined, undefined], ['', ''], ['abc', 'abc'], [999, 999], [1000, 1000], [1001, 1000], [1e9, 1000], [0, 0], [20, 20], ['5000', 1000], [-3, -3]]) {
  assert.strictEqual(capAnswerCount(v), want, `cap(${v})`);
}

// options.html：输入框带 max=1000，其余不变
const html = fs.readFileSync(new URL('../options/options.html', import.meta.url), 'utf8');
assert.match(html, /<input type="number" id="maxAnswerCount" name="maxAnswerCount" min="0" max="1000" value="20"/);

assert.ok(html.includes('问题页回答和首页、关注信息流通用。填 0 则尽量全部下载，最多 <span class="nw">1000 条</span>；被上限截断的导出会标为 truncated。'), '说明文案');
const css = fs.readFileSync(new URL('../options/options.css', import.meta.url), 'utf8');
// 设置页重做 M3：保存提示在卡片页脚里，不再是 fixed 浮层
const rule = css.match(/\.status-msg \{([^}]*)\}/)[1];
assert.match(rule, /position: static;/);
assert.ok(!/position: fixed/.test(css), '设置页不再有 fixed 浮层');

// 保存路径：真的加载 options.js，改输入框触发 change
const { window, document } = parseHTML(`<!doctype html><html><body>
<input type="checkbox" id="showFloatingBall" checked><input type="number" id="maxAnswerCount" value="20">
<input type="checkbox" id="downloadImages"><div id="note-maxAnswerCount"></div><div id="status"></div><span id="app-version"></span></body></html>`);
globalThis.window = window;
globalThis.document = document;
let stored = { showFloatingBall: true, maxAnswerCount: 5000, downloadImages: false };
const saved = [];
globalThis.chrome = { storage: { sync: {
  get: (defaults, done) => done({ ...defaults, ...stored }),
  set: (obj, done) => { saved.push(obj.maxAnswerCount); stored = { ...stored, ...obj }; done && done(); },
} } };
await import('../options/options.js');
const input = document.getElementById('maxAnswerCount');
document.dispatchEvent(new window.Event('DOMContentLoaded'));
assert.strictEqual(String(input.value), '1000', '旧的大值显示时截到 1000');
const save = (raw) => { input.value = raw; input.dispatchEvent(new window.Event('change')); return saved.at(-1); };
const status = document.getElementById('status');
const note = document.getElementById('note-maxAnswerCount');
assert.strictEqual(save('999'), 999);
assert.strictEqual(status.textContent, '✓ 已保存');
assert.strictEqual(note.textContent, '');
assert.strictEqual(save('1000'), 1000);
assert.strictEqual(note.textContent, '', '恰好 1000 不出警示行');
assert.strictEqual(save('1001'), 1000);
assert.strictEqual(String(input.value), '1000', '截断后回填输入框');
assert.strictEqual(note.textContent, '超过上限，已保存为 1000', '超过上限时数字框下方警示');
assert.strictEqual(status.textContent, '✓ 已保存', '页脚仍显示已保存');
assert.strictEqual(save('99999999999'), 1000);
assert.strictEqual(save('0'), 0, '0 仍表示尽量全部');
assert.strictEqual(note.textContent, '', '下次未截断的修改清掉警示行');
assert.strictEqual(save(''), 20, '空串 → 20');
assert.strictEqual(save('NaN'), 20);
// 原有处理不变：负数 → 0，非数字 → 20，小数取整
assert.strictEqual(save('-5'), 0);
assert.strictEqual(save('abc'), 20);
assert.strictEqual(save('12.7'), 12);
assert.strictEqual(save('1000.5'), 1000);

// 使用路径：问题页。第 1 页接口失败 → partial.total 就是实际目标条数
const { QuestionExporter } = await import('../content/modules/exporters/question.js');
const { FeedExporter } = await import('../content/modules/exporters/feed.js');
async function questionTarget(stored) {
  const q = parseHTML(`<!doctype html><html><body><h4 class="List-headerText">99999 个回答</h4>
<div class="AnswerItem" name="7"><span class="AuthorInfo-name">甲</span><div class="RichText ztext"><p>甲</p></div></div></body></html>`);
  globalThis.window = q.window;
  globalThis.document = q.document;
  q.window.scrollTo = () => {};
  Object.defineProperty(q.window, 'location', { configurable: true, value: { href: 'https://www.zhihu.com/question/9', pathname: '/question/9' } });
  globalThis.chrome = { storage: { sync: { get: (_d, done) => done({ maxAnswerCount: stored }) } } };
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const r = await QuestionExporter.exportMultipleAnswers(false);
  assert.strictEqual(r.success, true);
  return r.data.partial.total;
}
assert.strictEqual(await questionTarget(999), 999);
assert.strictEqual(await questionTarget(1000), 1000);
assert.strictEqual(await questionTarget(1001), 1000);
assert.strictEqual(await questionTarget(5000), 1000, 'storage 里的旧大值');
assert.strictEqual(await questionTarget(1e9), 1000);
assert.strictEqual(await questionTarget(0), 1000, '0：按页面声明数，最多 1000（原逻辑）');

// 使用路径：首页 / 关注动态，看传给滚动加载的目标条数
async function feedTarget(stored) {
  const f = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.window = f.window;
  globalThis.document = f.document;
  globalThis.chrome = { storage: { sync: { get: (_d, done) => done({ maxAnswerCount: stored }) } } };
  let got;
  const orig = FeedExporter.scrollToLoadFeedItems;
  FeedExporter.scrollToLoadFeedItems = async (n) => { got = n; };
  try { await FeedExporter.exportFeedItems('follow'); } finally { FeedExporter.scrollToLoadFeedItems = orig; }
  return got;
}
assert.strictEqual(await feedTarget(999), 999);
assert.strictEqual(await feedTarget(1000), 1000);
assert.strictEqual(await feedTarget(1001), 1000);
assert.strictEqual(await feedTarget(5000), 1000, 'storage 里的旧大值');
assert.strictEqual(await feedTarget(1e9), 1000);
assert.strictEqual(await feedTarget(0), 1000, '0：上限内不限，信息流按 1000');
assert.strictEqual(await feedTarget(null), null, 'null 原样（原逻辑）');
assert.strictEqual(await feedTarget('abc'), 'abc', '非数字原样（原逻辑）');

// 信息流：DOM 里卡片多于上限时只处理上限条（锁住 slice）
async function feedRun(stored, cards, reason = 'idle', dupes = 0) {
  // dupes：末尾 dupes 张卡片和第 1 张重复（同一链接），去重后少 dupes 条
  const items = Array.from({ length: cards }, (_, i) => { const n = i >= cards - dupes ? 1 : i + 1; return `<div class="TopstoryItem"><h2 class="ContentItem-title"><a href="https://www.zhihu.com/question/1/answer/${n}">t${n}</a></h2><div class="RichText">b</div></div>`; }).join('');
  const f = parseHTML(`<!doctype html><html><body>${items}</body></html>`);
  globalThis.window = f.window;
  globalThis.document = f.document;
  globalThis.chrome = { storage: { sync: { get: (_d, done) => done({ maxAnswerCount: stored }) } } };
  let processed = 0;
  const orig = [FeedExporter.scrollToLoadFeedItems, FeedExporter.processFeedItem];
  FeedExporter.scrollToLoadFeedItems = async () => (reason === 'non-object' ? undefined : { count: cards, reason });
  FeedExporter.processFeedItem = async () => { processed++; return { title: 't', author: 'a', content: 'c' }; };
  try {
    const r = await FeedExporter.exportFeedItems('home');
    return { processed, md: r.data.content };
  } finally { [FeedExporter.scrollToLoadFeedItems, FeedExporter.processFeedItem] = orig; }
}
assert.strictEqual((await feedRun(0, 1005)).processed, 1000, '设 0：1005 张卡片只处理 1000 条');
assert.strictEqual((await feedRun(1000, 1005)).processed, 1000, '设 1000：只处理 1000 条');
assert.strictEqual((await feedRun(20, 25)).processed, 20);
assert.strictEqual((await feedRun(0, 30)).processed, 30);
// 信息流被上限截断时文首写 truncated: true，没截断时不写
assert.match((await feedRun(0, 1005)).md, /^item_count: 1000\ntruncated: true$/m);
assert.match((await feedRun(20, 25)).md, /^item_count: 20\ntruncated: true$/m);
assert.doesNotMatch((await feedRun(1000, 1000)).md, /truncated/, '恰好取完不标');
assert.doesNotMatch((await feedRun(0, 30)).md, /truncated/);

// 停止原因：正好停在上限 → 标；超时 → 标；idle 取完不标、idle 卡片多于导出条数 → 标
assert.match((await feedRun(1000, 1000, 'limit')).md, /^item_count: 1000\ntruncated: true$/m, '正好等于上限');
assert.match((await feedRun(20, 20, 'limit')).md, /^item_count: 20\ntruncated: true$/m);
assert.match((await feedRun(0, 300, 'timeout')).md, /^item_count: 300\ntruncated: true$/m, '超时');
assert.doesNotMatch((await feedRun(0, 300, 'idle')).md, /truncated/, 'idle 取完不标');
assert.match((await feedRun(20, 25, 'idle')).md, /truncated: true/, 'idle 卡片多于导出条数');

// 审查 P3-1：滚动函数返回非对象（stub 返回 undefined）→ 没有停止原因，只按卡片数是否超过导出条数判断
assert.doesNotMatch((await feedRun(20, 20, 'non-object')).md, /truncated/, '非对象 20/20 不标');
assert.match((await feedRun(20, 25, 'non-object')).md, /^item_count: 20\ntruncated: true$/m, '非对象 20/25 标');
// 审查 P3-2：停在上限但去重后不足目标条数 → 也标（CHANGELOG「滚动停在上限」）
{
  const r = await feedRun(20, 20, 'limit', 3);
  assert.match(r.md, /^item_count: 17\ntruncated: true$/m, '停在上限、去重后 17/20 也标');
  assert.doesNotMatch((await feedRun(20, 20, 'idle', 3)).md, /truncated/, 'idle 去重后取完不标');
}

// scrollToLoadItemsWithReason 本身
{
  const { CONSTANTS, scrollToLoadItems, scrollToLoadItemsWithReason } = await import('../content/modules/constants.js');
  const w = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.window = w.window; globalThis.document = w.document; w.window.scrollTo = () => {};
  const saved = { ...CONSTANTS.DEFAULTS };
  CONSTANTS.DEFAULTS.SCROLL_INTERVAL = 1;
  try {
    assert.deepStrictEqual(await scrollToLoadItemsWithReason(() => 50, 20), { count: 50, reason: 'limit' });
    assert.deepStrictEqual(await scrollToLoadItemsWithReason(() => 5, 20), { count: 5, reason: 'idle' });
    let n = 0;
    CONSTANTS.DEFAULTS.SCROLL_TIMEOUT = 30;
    const r = await scrollToLoadItemsWithReason(() => ++n, 1e9);
    assert.strictEqual(r.reason, 'timeout');
    assert.strictEqual(await scrollToLoadItems(() => 50, 20), 50, '旧接口仍返回数量');
  } finally { Object.assign(CONSTANTS.DEFAULTS, saved); }
}

console.log('answer limit tests passed');
