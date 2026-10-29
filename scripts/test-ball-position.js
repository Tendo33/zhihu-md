// QA e2fa5da P4：恢复悬浮球位置时夹到视口内（QA 在 1280 左上角看到 -12,-12），并且写在页面上的那个球上
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
globalThis.requestAnimationFrame = (f) => f();
let stored = null;
globalThis.chrome = {
  i18n: { getMessage: () => '' }, runtime: {},
  storage: { local: { get: (k, cb) => cb(stored ? { floatingBallPosition: stored } : {}), set: () => {} } },
};
Object.assign(window, { innerWidth: 1280, innerHeight: 800 });

const { clampBallPosition } = await import('../content/modules/floating-ball-drag.js');
assert.deepEqual(clampBallPosition(-12, -12, 44, 44, 1280, 800), { x: 0, y: 0 });
assert.deepEqual(clampBallPosition(5000, 5000, 44, 44, 1280, 800), { x: 1236, y: 756 });
assert.deepEqual(clampBallPosition(NaN, undefined, 44, 44, 1280, 800), { x: 0, y: 0 });
assert.deepEqual(clampBallPosition(100, 100, 44, 44, 30, 30), { x: 0, y: 0 }, '窗口比球小时贴在 0，不出现负数');
assert.deepEqual(clampBallPosition(300, 200, 44, 44, 1280, 800), { x: 300, y: 200 });

const { FloatingBall } = await import('../content/modules/floating-ball.js');
const live = () => document.getElementById('zhihu-md-floating-ball');
for (const [pos, want] of [[{ x: -12, y: -12 }, ['0px', '0px']], [{ x: 9999, y: 9999 }, ['1236px', '756px']], [{ x: 400, y: 300 }, ['400px', '300px']]]) {
  stored = pos;
  FloatingBall.setupBallElement();
  assert.equal(live(), FloatingBall.ball);
  assert.deepEqual([live().style.left, live().style.top], want, `恢复 ${JSON.stringify(pos)}`);
  FloatingBall.remove();
}
// 审查 a833a13 P3-2：x/y 不是有限数时保持默认位置（不设 left/top，不吸边）
for (const bad of [{}, { x: 'abc', y: null }, { x: NaN, y: 100 }, { x: 100, y: Infinity }, { x: '', y: 5 }, { x: 100 }]) {
  stored = bad;
  FloatingBall.setupBallElement();
  assert.deepEqual([live().style.left, live().style.top], ['', ''], `坏值 ${JSON.stringify(bad)} 保持默认位置`);
  assert.ok(!live().classList.contains('docked-left') && !live().classList.contains('docked-right'));
  FloatingBall.remove();
}
stored = { x: '300', y: '200' };
FloatingBall.setupBallElement();
assert.deepEqual([live().style.left, live().style.top], ['300px', '200px'], '数字字符串仍可恢复');
FloatingBall.remove();
// 窗口缩小后重新夹到视口内
stored = { x: 1200, y: 700 };
FloatingBall.setupBallElement();
Object.assign(window, { innerWidth: 600, innerHeight: 400 });
window.dispatchEvent(new window.Event('resize'));
assert.deepEqual([live().style.left, live().style.top], ['556px', '356px']);
FloatingBall.remove();
console.log('ball position tests passed');
