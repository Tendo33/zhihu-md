import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { ballA11y, applyBallA11y, idleAriaLabel } from '../content/modules/ball-a11y.js';

assert.deepEqual(ballA11y('normal'), { label: '导出 Markdown（点击下载，右键复制）', busy: false });
assert.equal(idleAriaLabel(), '导出 Markdown（点击下载，右键复制）', '没有 chrome.i18n 时回退中文');
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
assert.equal(ballA11y('success', '导出成功!').label, '导出成功。再次点击可重新导出');
assert.equal(ballA11y('loading', '导出中...').label, '正在导出：导出中');
console.log('ball-a11y punctuation tests passed');
