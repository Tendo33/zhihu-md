// Z3-2：悬浮球 M↓ 字形、进度环、成功/失败图标，以及 reduced-motion 下不转圈
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';
const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
const { FloatingBall } = await import('../content/modules/floating-ball.js');
const ball = FloatingBall.createFloatingBall();
assert.equal(ball.querySelector('.glyph').textContent, 'M↓');
assert.ok(ball.querySelector('.ring'));
assert.equal(ball.querySelector('.glyph').getAttribute('aria-hidden'), 'true');
FloatingBall.updateBallState(ball, 'loading');
assert.ok(ball.classList.contains('loading') && ball.querySelector('.glyph'));
FloatingBall.updateBallState(ball, 'success');
assert.ok(ball.classList.contains('success') && !ball.classList.contains('loading'));
assert.match(ball.querySelector('.face').innerHTML, /M5 12l5 5L20 7/);
FloatingBall.updateBallState(ball, 'error');
assert.match(ball.querySelector('.face').innerHTML, /circle/);
FloatingBall.updateBallState(ball, 'idle');
assert.equal(ball.className, '');
assert.equal(ball.querySelector('.glyph').textContent, 'M↓');

const css = fs.readFileSync(new URL('../content/content.css', import.meta.url), 'utf8');
const rm = css.slice(css.indexOf('prefers-reduced-motion'));
assert.match(rm, /\.ring[\s\S]*animation: none !important/);
assert.match(css, /--success: #0f7a3d/);
assert.match(css, /--error: #b42318/);
assert.match(css, /width: 44px;\s*height: 44px;/);
console.log('ball face tests passed');
