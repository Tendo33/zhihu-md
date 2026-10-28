import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { ballA11y, applyBallA11y, IDLE_LABEL } from '../content/modules/ball-a11y.js';

assert.deepEqual(ballA11y('normal'), { label: IDLE_LABEL, busy: false });
assert.equal(ballA11y('loading', '下载图片中...').busy, true);
assert.match(ballA11y('loading', '下载图片中...').label, /正在导出：下载图片中/);
assert.match(ballA11y('error', '需要登录知乎才能查看这部分内容').label, /^导出失败：需要登录知乎.*按回车重试$/);
assert.match(ballA11y('success', '已复制').label, /已复制/);

const { document } = parseHTML('<!doctype html><html><body><button id="b"></button></body></html>');
const b = document.getElementById('b');
applyBallA11y(b, 'loading', '导出中...');
assert.equal(b.getAttribute('aria-busy'), 'true');
applyBallA11y(b, 'error', 'x');
assert.equal(b.hasAttribute('aria-busy'), false);
assert.match(b.getAttribute('aria-label'), /导出失败/);
console.log('ball-a11y tests passed');
