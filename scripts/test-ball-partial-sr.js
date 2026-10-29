// QA P2Z-02：悬浮球「部分导出」的读屏文字（aria-label + live region）要带上图片失败数和保留数；tooltip 不变
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { imagePartialSrExtra, imagePartialLine, IMAGE_KEPT_REASON } from '../lib/image-pack.js';

// 纯函数：与弹窗琥珀提示的图片行同一套文案；只有保留时带原因（同成功态）
assert.equal(imagePartialSrExtra(0, 0), '');
assert.equal(imagePartialSrExtra(3, 0), '3 张图片未能下载，已保留在线链接');
assert.equal(imagePartialSrExtra(3, 2), '3 张图片未能下载，已保留在线链接，另有 2 张保留为在线链接');
assert.equal(imagePartialLine(3, 2), '3 张图片未能下载，另有 2 张保留为在线链接');
assert.equal(imagePartialSrExtra(0, 5), `5 张图片保留为在线链接。${IMAGE_KEPT_REASON}`);

const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
let dl = null;
globalThis.chrome = {
  storage: { sync: { get: (d, cb) => cb({ ...d, downloadImages: true }) } },
  runtime: { sendMessage: async () => dl },
};
const { FloatingBall } = await import('../content/modules/floating-ball.js');
const { PageDetector } = await import('../content/modules/detector.js');
const { QuestionExporter } = await import('../content/modules/exporters/question.js');
PageDetector.detectPageType = () => 'question';
QuestionExporter.exportMultipleAnswers = async () => ({
  success: true,
  data: { filename: 'q.md', content: '# q', images: [{ url: '//pic3.zhimg.com/a.jpg', filename: 'img_001_a.jpg' }], partial: { exported: 43, total: 60, failedPage: 3 } },
});
const ball = FloatingBall.createFloatingBall();

const TOOLTIP = '部分导出：已导出 43/60 条，17 条未能加载';
async function run(res) {
  dl = res;
  FloatingBall.busy = false;
  await FloatingBall.handleBallClick(ball);
  return {
    tooltip: ball.querySelector('.tooltip').textContent,
    live: document.getElementById('zhihu-md-live').textContent,
    label: ball.getAttribute('aria-label'),
    warning: ball.classList.contains('warning'),
  };
}

const cases = [
  // P2Z-B（设计决定）：概况和图片情况之间用「；」
  [{ success: true, failedImages: 3, keptImages: 0 }, '部分导出：已导出 43/60 条，17 条未能加载；3 张图片未能下载，已保留在线链接'],
  [{ success: true, failedImages: 3, keptImages: 2 }, '部分导出：已导出 43/60 条，17 条未能加载；3 张图片未能下载，已保留在线链接，另有 2 张保留为在线链接'],
  [{ success: true, failedImages: 0, keptImages: 5 }, `${TOOLTIP}；5 张图片保留为在线链接。${IMAGE_KEPT_REASON}`],
  [{ success: true, failedImages: 0, keptImages: 0 }, TOOLTIP],
  [{ success: true, downloadId: 1 }, TOOLTIP],
];
for (const [res, spoken] of cases) {
  const r = await run(res);
  assert.ok(r.warning, '警告态');
  assert.equal(r.tooltip, TOOLTIP, 'tooltip 不变');
  assert.equal(r.live, spoken, `live region：${JSON.stringify(res)}`);
  assert.equal(r.label, `${spoken}。再次点击可重新导出`, `aria-label：${JSON.stringify(res)}`);
  assert.doesNotMatch(r.label, /失败/, '警告态读屏不出现「失败」（M1）');
  assert.doesNotMatch(r.label, /导出失败/, '警告态不用「导出失败：」前缀');
}

// 审查预提示：「；」只用在部分导出读屏里概况和图片情况之间；成功态（同一个 setMessage）仍用「，」，
// 「保留为在线链接，原因」内部的逗号也不变
QuestionExporter.exportMultipleAnswers = async () => ({
  success: true,
  data: { filename: 'q.md', content: '# q', images: [{ url: '//pic3.zhimg.com/a.jpg', filename: 'img_001_a.jpg' }] },
});
const successCases = [
  [{ success: true, failedImages: 3, keptImages: 0 }, '已导出，3 张图片未能下载，已保留在线链接', '已导出，3 张图片未能下载，已保留在线链接'],
  [{ success: true, failedImages: 3, keptImages: 2 }, '已导出，3 张图片未能下载，已保留在线链接', '已导出，3 张图片未能下载，已保留在线链接，另有 2 张保留为在线链接'],
  // QA e2fa5da P4（Z85-02）：只有保留时 tooltip 也带张数（1 张、多张），读屏原因单独成句
  [{ success: true, failedImages: 0, keptImages: 5 }, '已导出，5 张图片保留为在线链接', `已导出，5 张图片保留为在线链接。${IMAGE_KEPT_REASON}`],
  [{ success: true, failedImages: 0, keptImages: 1 }, '已导出，1 张图片保留为在线链接', `已导出，1 张图片保留为在线链接。${IMAGE_KEPT_REASON}`],
  [{ success: true, failedImages: 0, keptImages: 0 }, '已导出', '已导出'],
];
for (const [res, tip, spoken] of successCases) {
  const r = await run(res);
  assert.ok(!r.warning, '成功态不是警告态');
  assert.equal(r.tooltip, tip);
  assert.equal(r.live, spoken, `成功态 live：${JSON.stringify(res)}`);
  assert.doesNotMatch(r.live, /；/, '成功态不用「；」');
  assert.equal(r.label, `${spoken}。再次点击可重新导出`);
}
console.log('ball partial sr tests passed');
