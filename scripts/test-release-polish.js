// 发版前 UI 审计（design-release-audit-2026-10-29）：文案与样式断言
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// B1：popup 与悬浮球「正在导出…」统一，全角省略号，无半角「!」
{
  const popup = read('popup/popup.js');
  const ball = read('content/modules/floating-ball.js');
  assert.match(popup, /exportLabel\.textContent = '正在导出…';/);
  assert.match(popup, /updateStatus\('run', '正在导出'\);/);
  assert.ok(!popup.includes('转换中'), 'popup 不再出现「转换中」');
  for (const t of ['正在加载内容…', '正在导出热榜…', "downloadImages ? '正在下载图片…' : '正在导出…'", "'已导出'", '正在复制…']) assert.ok(ball.includes(t), t);
  const lits = [...ball.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]);
  assert.deepEqual(lits.filter((x) => /\.\.\.$|!$/.test(x)), [], '悬浮球文案不用半角 ... 或 !');
}
console.log('release-polish tests passed');
