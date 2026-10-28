// Round 3 C-2：最近导出记录与相对时间
import assert from 'node:assert/strict';
import { addRecent, recordRecent, relativeTime, titleFromFilename, RECENT_MAX } from '../lib/recent-exports.js';

let list = [];
for (let i = 0; i < 25; i++) list = addRecent(list, { title: 't' + i, ok: i % 2 === 0 }, 1000 + i);
assert.equal(list.length, RECENT_MAX);
assert.equal(list[0].title, 't24'); assert.equal(list[0].ok, true); assert.equal(list[0].ts, 1024);
assert.equal(addRecent(null, { title: 'x'.repeat(500) })[0].title.length, 200);
assert.deepEqual(Object.keys(list[0]).sort(), ['ok', 'title', 'ts'], '不存正文');

const store = {};
const storage = { local: { get: async (d) => ({ ...d, ...store }), set: async (o) => Object.assign(store, o) } };
await recordRecent(storage, { title: 'a', ok: true });
await recordRecent(storage, { title: 'b', ok: false });
assert.deepEqual(store.recentExports.map((e) => e.title), ['b', 'a']);
await recordRecent(undefined, { title: 'c' });

const now = new Date(2026, 9, 28, 19, 0, 0).getTime();
assert.equal(relativeTime(now - 5000, now), '刚刚');
assert.equal(relativeTime(now - 120000, now), '2 分钟前');
assert.equal(relativeTime(now - 3 * 3600000, now), '3 小时前');
assert.equal(relativeTime(new Date(2026, 9, 27, 23, 0).getTime(), now), '昨天');
assert.equal(relativeTime(new Date(2026, 9, 25, 10, 0).getTime(), now), '3 天前');
assert.equal(relativeTime(now + 9999, now), '刚刚', '时钟回拨不出负数');

assert.equal(titleFromFilename('zhihu/如何评价X-张三.md'), '如何评价X-张三');
assert.equal(titleFromFilename('a_with_images.zip'), 'a');
console.log('recent-exports tests passed');
