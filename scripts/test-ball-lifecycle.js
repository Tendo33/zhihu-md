// 审查 e2fa5da P3：setupBallElement 挂到 window 的 resize 监听，在 remove() 和重建时摘掉；
// remove 之后再触发 resize，不应再对球做定位
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
globalThis.requestAnimationFrame = (f) => f();
globalThis.chrome = { i18n: { getMessage: () => '' }, storage: {}, runtime: {} };
Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
Object.defineProperty(document.documentElement, 'clientWidth', { value: 1280, configurable: true });
Object.defineProperty(document.documentElement, 'clientHeight', { value: 800, configurable: true });
const rect = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t });

const { FloatingBall } = await import('../content/modules/floating-ball.js');

// 统计定位次数：placeTooltip 每次都会先把 tooltip 的 left 写成 0px 再算，这里用哨兵值看它有没有被改写
const placedBy = () => {
  const tip = document.querySelector('#zhihu-md-floating-ball .tooltip') || FloatingBall.ball?.querySelector('.tooltip');
  tip.style.left = '777px';
  window.dispatchEvent(new window.Event('resize'));
  return tip.style.left !== '777px';
};
const stub = () => {
  const b = FloatingBall.ball;
  b.getBoundingClientRect = () => rect(1200, 400, 44, 44);
  const tip = b.querySelector('.tooltip');
  tip.getBoundingClientRect = () => rect(0, 0, 200, 32);
  Object.defineProperty(tip, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(tip, 'offsetHeight', { value: 32, configurable: true });
};

FloatingBall.setupBallElement(); stub();
assert.ok(placedBy(), '挂上后 resize 应重新定位（否则下面的断言没有意义）');
// 重建一次：旧监听摘掉，只剩新球的
const old = FloatingBall.ball;
FloatingBall.setupBallElement(); stub();
const oldTip = old.querySelector('.tooltip'); oldTip.style.left = '777px';
window.dispatchEvent(new window.Event('resize'));
assert.equal(oldTip.style.left, '777px', '重建后旧球不应再被 resize 定位');

FloatingBall.remove();
assert.equal(document.getElementById('zhihu-md-floating-ball'), null);
assert.equal(placedBy(), false, 'remove() 之后 resize 不应再调用定位');
console.log('ball lifecycle tests passed');
