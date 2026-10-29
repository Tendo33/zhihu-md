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
assert.deepEqual(clampBallPosition(-12, -12, 44, 44, 1280, 800), { x: 4, y: 4 }, '离边 4px');
assert.deepEqual(clampBallPosition(5000, 5000, 44, 44, 1280, 800), { x: 1232, y: 752 });
assert.deepEqual(clampBallPosition(NaN, undefined, 44, 44, 1280, 800), { x: 4, y: 4 });
assert.deepEqual(clampBallPosition(100, 100, 44, 44, 30, 30), { x: 0, y: 0 }, '窗口比球小时贴在 0，不出现负数');
assert.deepEqual(clampBallPosition(300, 200, 44, 44, 1280, 800), { x: 300, y: 200 });

const { FloatingBall } = await import('../content/modules/floating-ball.js');
const live = () => document.getElementById('zhihu-md-floating-ball');
for (const [pos, want] of [[{ x: -12, y: -12 }, ['4px', '4px']], [{ x: 9999, y: 9999 }, ['1232px', '752px']], [{ x: 400, y: 300 }, ['400px', '300px']]]) {
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
assert.deepEqual([live().style.left, live().style.top], ['552px', '352px']);
FloatingBall.remove();
// 审查 a9bbc6e P4：只认十进制数字字符串
{
  const { isStoredCoord } = await import('../content/modules/floating-ball-drag.js');
  for (const bad of ['0x10', '0X10', '1e2', 'Infinity', '0b1', '0o7', '', '  ', '12px', '+5']) assert.equal(isStoredCoord(bad), false, `坏字符串 ${bad}`);
  for (const ok of ['300', ' 300 ', '-20', '12.5', '0']) assert.equal(isStoredCoord(ok), true, `十进制 ${ok}`);
  stored = { x: '0x10', y: '100' };
  FloatingBall.setupBallElement();
  assert.deepEqual([live().style.left, live().style.top], ['', ''], "'0x10' 不能当 16 恢复");
  FloatingBall.remove();
}
// 审查 a9bbc6e P3：clampBallPosition / clampToViewport / handleSnapAndDock / restorePosition 都按 clientWidth（不含滚动条）
{
  const de = document.documentElement;
  Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
  Object.defineProperty(de, 'clientWidth', { configurable: true, get: () => 1265 });
  Object.defineProperty(de, 'clientHeight', { configurable: true, get: () => 785 });
  const { viewportSize, floatingBallDrag } = await import('../content/modules/floating-ball-drag.js');
  assert.deepEqual(viewportSize(), { vw: 1265, vh: 785 });
  stored = { x: 9999, y: 9999 };
  FloatingBall.setupBallElement();
  assert.deepEqual([live().style.left, live().style.top], ['1217px', '737px'], 'restorePosition 夹到 clientWidth/clientHeight');
  live().style.left = '1250px'; live().style.top = '790px';
  floatingBallDrag.clampToViewport(live());
  assert.deepEqual([live().style.left, live().style.top], ['1217px', '737px'], 'clampToViewport 用 clientWidth');
  const saved = [];
  const fake = { style: {}, classList: { add() {} } };
  fake.getBoundingClientRect = () => ({ left: 1200, right: 1244, top: 100, width: 44 });
  const orig = floatingBallDrag.savePosition; floatingBallDrag.savePosition = (x, y) => saved.push([x, y]);
  floatingBallDrag.handleSnapAndDock(fake);
  floatingBallDrag.savePosition = orig;
  assert.equal(fake.style.left, '1217px', 'handleSnapAndDock 吸右到 clientWidth - w，不压在滚动条下');
  assert.deepEqual(saved.at(-1), [1217, 100]);
  FloatingBall.remove();
  delete de.clientWidth; delete de.clientHeight;
}
// 设计验收必改 1：留 4px 后窗口太小仍不出现负数；吸左也是 4px
assert.deepEqual(clampBallPosition(100, 100, 44, 44, 50, 50), { x: 6, y: 6 });
{
  const { floatingBallDrag } = await import('../content/modules/floating-ball-drag.js');
  const fake = { style: {}, classList: { add() {} }, getBoundingClientRect: () => ({ left: 10, right: 54, top: 100, width: 44 }) };
  const orig = floatingBallDrag.savePosition; const saved = []; floatingBallDrag.savePosition = (x, y) => saved.push([x, y]);
  floatingBallDrag.handleSnapAndDock(fake); floatingBallDrag.savePosition = orig;
  assert.equal(fake.style.left, '4px', '吸左离边 4px'); assert.deepEqual(saved.at(-1), [4, 100]);
}
console.log('ball position tests passed');
