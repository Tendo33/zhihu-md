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
// B2：设置页悬浮球标题与适用范围
{
  const html = read('options/options.html');
  assert.match(html, /id="label-showFloatingBall" for="showFloatingBall">悬浮导出球</);
  assert.match(html, /id="desc-showFloatingBall">在知乎首页、关注、热榜、问题、回答和专栏页显示悬浮球：点击下载，右键复制。</);
  assert.ok(!html.includes('悬浮导出按钮') && !html.includes('知乎文章页面'));
}
// B3：数字输入框边框用 --text-2（即 --text-tertiary，非文本对比度 ≥3:1；设置页重做 M5 直接写 v2 token）
{
  const css = read('options/options.css');
  const rule = css.match(/\.number-input \{([^}]*)\}/)[1];
  assert.match(rule, /border: 1px solid var\(--text-2\);/);
}
// N2：悬浮球提示与球本体同一中文字体栈
{
  const css = read('content/content.css');
  const tip = css.match(/#zhihu-md-floating-ball \.tooltip \{([^}]*)\}/)[1];
  assert.match(tip, /font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans", sans-serif;/);
}
// N3：成功态提示不依赖悬停
{
  const css = read('content/content.css');
  const at = css.indexOf('#zhihu-md-floating-ball:hover .tooltip,');
  const sel = css.slice(at, css.indexOf('{', at));
  assert.ok(sel.includes('#zhihu-md-floating-ball.success .tooltip'), 'success .tooltip 在可见规则里');
}
console.log('release-polish tests passed');
