// 设置页重做（设计 2026-10-29 M1–M7）：开关单旋钮、同行居中、嵌入式对话框、页脚保存提示、标题、数字框、文案、层级与语义
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { descText } from './options-desc-text.js';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('options/options.css');
const ui = read('lib/ui-v2.css');
const rule = (sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)${esc} \\{([^}]*)\\}`));
  return m ? m[1] : null;
};

// M1：只有一颗旋钮（ui-v2 的 ::after），options.css 不再画 ::before 旋钮
assert.ok(!/\.slider:before/.test(css), 'M1：不再有 .slider:before');
assert.match(rule('.switch .slider::before'), /content: none;/, 'M1：显式关掉 ::before');
assert.match(ui, /\.switch span::after\{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px/, 'ui-v2 旋钮仍在');
{
  const sw = rule('.switch');
  assert.match(sw, /width: 40px;/); assert.match(sw, /height: 24px;/);
  const knob = rule('.switch .slider::after');
  assert.match(knob, /top: 3px;/); assert.match(knob, /left: 3px;/); assert.match(knob, /width: 18px;/); assert.match(knob, /height: 18px;/);
  assert.match(rule('.switch input:checked + .slider::after'), /transform: translateX\(16px\);/);
  assert.match(rule('.switch .slider'), /border: 0;/, '轨道无边框，几何按 40 宽算');
  // 几何：左右两侧都是 3px
  const W = 40, K = 18, P = 3, X = 16;
  assert.equal(P, (24 - K) / 2); assert.equal(W - (P + X + K), 3);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\s*\.switch \.slider::after \{ box-shadow: none; \}/, '深色下旋钮无阴影');
}
console.log('options redesign tests passed');

// M2：同行居中、卡片随内容（审查 P2：open_in_tab 为 true，嵌入模式代码已删）
{
  assert.ok(!/@media \(max-width: 480px\) \{\s*\.option-item \{\s*flex-direction: column/.test(css), 'M2：不再在 ≤480 改竖排');
  assert.match(rule('.option-item'), /align-items: center;/);
  assert.match(css, /\nbody \{[^}]*min-height: 100vh;[^}]*align-items: flex-start;/, 'M2：卡片不被拉伸');
  assert.ok(!/embedded/.test(css), '审查 P2：不再有 .embedded 样式');
  assert.ok(!/markEmbedded|getCurrent/.test(read('options/options.js')), '审查 P2：不再判断嵌入');
  const mf = JSON.parse(read('manifest.src.json'));
  assert.equal(mf.options_ui.open_in_tab, true, 'open_in_tab 保持 true');
  console.log('options redesign M2 passed');
}

// M3：保存提示在页脚（左），版本号在右；超限警示行在数字框下方并被 aria-describedby 关联
{
  const html = read('options/options.html');
  const footer = html.slice(html.indexOf('<footer class="footer">'), html.indexOf('</footer>'));
  assert.match(footer, /<span id="status" class="status-msg" role="status" aria-live="polite" aria-atomic="true"><\/span>\s*<span class="ver">Zhihu to Markdown <span id="app-version"><\/span><\/span>/, 'M3：提示在页脚左、版本号在右');
  assert.ok(html.indexOf('id="status"') < html.indexOf('</footer>') && html.indexOf('id="status"') > html.indexOf('<footer'), 'status 在页脚内');
  assert.match(html, /<div class="field-note" id="note-maxAnswerCount" role="status" aria-live="polite"><\/div>/);
  assert.match(html, /aria-describedby="desc-maxAnswerCount note-maxAnswerCount"/);
  assert.match(rule('.status-msg'), /position: static;/);
  assert.ok(!/position: fixed/.test(css), 'M3：没有 fixed 浮层');
  assert.match(rule('.field-note'), /color: var\(--warning\);/);
  assert.match(read('options/options.js'), /\}, 2500\);/, '2.5 秒后淡出');
  console.log('options redesign M3 passed');
}

// M4：标题改为「最大下载条数」
{
  const html = read('options/options.html');
  assert.match(html, /id="label-maxAnswerCount"[^>]*>最大下载条数</);
  assert.ok(!html.includes('最大下载回答数'), 'M4：旧标题不再出现');
  console.log('options redesign M4 passed');
}

// M5：数字框
{
  const html = read('options/options.html');
  assert.match(html, /<div class="option-item option-item--field">/);
  assert.match(html, /<div class="num">\s*<input type="number" id="maxAnswerCount"[^>]*class="number-input"[^>]*>\s*<span class="num-unit" aria-hidden="true">条<\/span>\s*<\/div>/, 'M5：单位「条」紧跟数字框');
  const n = rule('.number-input');
  assert.match(n, /width: 88px;/); assert.match(n, /text-align: right;/); assert.match(n, /appearance: textfield;/); assert.match(n, /-moz-appearance: textfield;/, 'Firefox 去箭头');
  assert.match(css, /\.number-input::-webkit-inner-spin-button,\s*\.number-input::-webkit-outer-spin-button \{\s*-webkit-appearance: none;/, 'WebKit 去箭头');
  assert.ok(!/\.number-input \{[^}]*width: 100%/.test(css), 'M5：窄屏不拉满');
  console.log('options redesign M5 passed');
}

// M6：三项说明新文案（逐字照设计规格）、text-wrap: pretty、「1000 条」不断行
{
  const html = read('options/options.html');
  // B1 之后说明里按短语包了 .nw，文案按 textContent 比对（与规格逐字一致）
  assert.equal(descText(html, 'showFloatingBall'), '在知乎首页、关注、热榜、问题、回答和专栏页显示悬浮球：点击下载，右键复制。');
  assert.equal(descText(html, 'maxAnswerCount'), '问题页回答和首页、关注信息流通用。填 0 则尽量全部下载，最多 1000 条；被上限截断的导出会标注为已截断。');
  assert.equal(descText(html, 'downloadImages'), '把文章里的图片一起保存，导出为含 .md 和 images 文件夹的 ZIP 包；关闭时图片保留在线链接。');
  assert.match(rule('.option-desc'), /text-wrap: pretty;/);
  assert.match(rule('.option-desc'), /color: var\(--text-2\);/);
  assert.match(rule('.nw'), /white-space: nowrap;/);
  console.log('options redesign M6 passed');
}

// M7：层级与间距、语义（<label for>、role="switch"、原生 checkbox 不写 aria-checked，审查第 2 条）
{
  const html = read('options/options.html');
  assert.match(css, /\nbody \{\s*background-color: var\(--bg\);/, 'M7：页面 --bg');
  assert.match(rule('.container'), /background: var\(--surface\);/, 'M7：卡片 --surface');
  assert.match(rule('.header'), /padding: 20px 24px;/);
  assert.match(rule('.option-item'), /padding: 16px 24px;/);
  assert.match(rule('.section'), /padding: 0;/);
  assert.ok(!/padding-right: 20px/.test(rule('.option-content')));
  assert.match(rule('.option-label'), /font-weight: 600;/);
  assert.match(rule('.option-item:hover'), /var\(--state-hover\)/);
  for (const k of ['showFloatingBall', 'maxAnswerCount', 'downloadImages']) {
    assert.match(html, new RegExp(`<label class="option-label" id="label-${k}" for="${k}">`), `${k} 用 <label for>`);
  }
  assert.ok(!html.includes('<label class="switch">'), '开关外层不再是 label（避免嵌套 label）');
  assert.equal((html.match(/<input type="checkbox" role="switch" id=/g) || []).length, 2);
  assert.ok(!html.includes('aria-checked'), '审查第 2 条：原生 checkbox 不写 aria-checked');
  assert.ok(!/aria-checked|syncSwitchState/.test(read('options/options.js')), '审查第 2 条：JS 不再同步 aria-checked');
  assert.equal((html.match(/<span class="slider" aria-hidden="true"><\/span>/g) || []).length, 2);
  // 读取设置、切换后保存（状态由原生 checked 表达）
  const { parseHTML } = await import('linkedom');
  const page = parseHTML(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  globalThis.window = page.window; globalThis.document = page.document;
  let store = { showFloatingBall: true, maxAnswerCount: 20, downloadImages: false };
  globalThis.chrome = { storage: { sync: { get: (d, cb) => cb({ ...d, ...store }), set: (o, cb) => { store = { ...store, ...o }; cb && cb(); } } } };
  await import('../options/options.js?m7');
  page.document.dispatchEvent(new page.window.Event('DOMContentLoaded'));
  const ball = page.document.getElementById('showFloatingBall');
  const img = page.document.getElementById('downloadImages');
  assert.equal(ball.checked, true, '读取后勾选');
  assert.equal(img.checked, false);
  img.checked = true; img.dispatchEvent(new page.window.Event('change'));
  assert.equal(store.downloadImages, true);
  assert.equal(page.document.getElementById('status').textContent, '✓ 已保存');
  console.log('options redesign M7 passed');
}

// 设计验收 B1：三段说明按短语包 .nw（只在标点 / 空格处断行），空格在 span 外，textContent 不变
{
  const html = read('options/options.html');
  const { parseHTML } = await import('linkedom');
  const doc = parseHTML(html).document;
  for (const k of ['showFloatingBall', 'maxAnswerCount', 'downloadImages']) {
    const el = doc.getElementById(`desc-${k}`);
    const kids = [...el.childNodes];
    // 只能是 .nw span 或纯空格文本节点
    for (const n of kids) {
      if (n.nodeType === 3) assert.match(n.textContent, /^ $/, `${k}：span 外只能是单个空格`);
      else assert.ok(n.tagName === 'SPAN' && n.className === 'nw', `${k}：子节点都是 span.nw`);
    }
    for (const sp of el.querySelectorAll('span.nw')) assert.ok(!/^\s|\s$/.test(sp.textContent), `${k}：空格不能在 span 首尾（320 会溢出）`);
    assert.ok(el.querySelectorAll('span.nw').length >= 6, `${k}：按短语拆开`);
  }
  // options.js 不会改写说明（会把 span 冲掉）
  assert.ok(!/desc-|option-desc|innerHTML/.test(read('options/options.js')), 'options.js 不重写说明');
  console.log('options redesign B1 passed');
}

// 设计验收 S2：数字框聚焦只保留一道 2px 外圈（和开关一致），边框保持 --text-2
{
  const fv = rule('.number-input:focus-visible');
  assert.match(fv, /border-color: var\(--text-2\);/, 'S2：聚焦时边框不变蓝');
  assert.match(fv, /outline: 2px solid var\(--focus\);/, 'S2：保留 2px 焦点外圈');
  assert.match(fv, /outline-offset: 2px;/);
  console.log('options redesign S2 passed');
}

// 审查第 3 条：1.1.8 未发布，条目并入 1.1.8 段，[Unreleased] 留空，不重复
{
  const log = read('CHANGELOG.md');
  const unrel = log.slice(log.indexOf('## [Unreleased]'), log.indexOf('## [1.1.8]'));
  assert.ok(log.includes('## [Unreleased]') && !/^- /m.test(unrel), '[Unreleased] 留空');
  const sec = log.slice(log.indexOf('## [1.1.8]'), log.indexOf('## [1.1.7]'));
  assert.match(sec, /### 改进[\s\S]*导出本页为 Markdown[\s\S]*设置页按设计稿重做/);
  assert.match(sec, /### 修复[\s\S]*background\.scripts[\s\S]*### 改进/, 'bg-scripts 条目并入 1.1.8 修复');
  assert.equal(sec.split('超过上限，已保存为 1000').length - 1, 1, '超限提示只写一次');
  assert.ok(!log.includes('嵌入对话框'), '不再提嵌入对话框');
  console.log('changelog merge passed');
}

// 设计复核 M2：数字框提示在输入行下方，上方 6px，aria-describedby 不变
{
  const html = read('options/options.html');
  const item = html.slice(html.indexOf('<div class="option-item option-item--field">'), html.indexOf('<div class="option-item">', html.indexOf('option-item--field')));
  const content = item.slice(item.indexOf('<div class="option-content">'), item.indexOf('<div class="num">'));
  assert.ok(!content.includes('note-maxAnswerCount"'), '复核 M2：提示不在说明和数字框之间');
  assert.ok(item.indexOf('id="note-maxAnswerCount"') > item.indexOf('<div class="num">'), '复核 M2：提示在输入行之后');
  assert.match(html, /aria-describedby="desc-maxAnswerCount note-maxAnswerCount"/);
  // 复核 2f4a629：.num 和提示包在同一个 .field-col 里，所有宽度间距都由 gap: 6px 决定
  assert.match(item, /<div class="field-col">\s*<div class="num">[\s\S]*?<\/div>\s*<div class="field-note" id="note-maxAnswerCount" role="status" aria-live="polite"><\/div>\s*<\/div>\s*<\/div>/, '复核 M2：.field-col 只包 .num 和提示');
  assert.ok(!/\.option-item--field \{[^}]*(flex-wrap|row-gap)/.test(css), '复核 M2：去掉整行换行和 row-gap');
  assert.ok(!/flex: 0 0 100%|margin-top: -4px/.test(css), '复核 M2：去掉 flex: 0 0 100% 和 margin-top: -4px');
  assert.match(css, /\n\.field-col \{\s*display: flex;\s*flex-direction: column;\s*align-items: flex-end;\s*align-self: flex-start;\s*gap: 6px;\s*flex: none;\s*\}/);
  assert.match(css, /\n\.field-col \.field-note \{\s*text-align: right;\s*\}/);
  const narrow = css.slice(css.indexOf('@media (max-width: 480px)'));
  assert.match(narrow, /\.field-col \{\s*align-items: flex-start;\s*\}/, '≤480：左对齐');
  assert.match(narrow, /\.field-col \.field-note \{\s*text-align: left;\s*\}/);
  console.log('design recheck M2 passed');
}

// 主管：0 =「尽可能多（上限 1000）」哨兵值语义不变，数字框旁说明必须写明
{
  const html = read('options/options.html');
  const desc = descText(html, 'maxAnswerCount');
  assert.ok(desc.includes('填 0 则尽量全部下载') && desc.includes('最多 1000 条'), '说明写明 0 = 尽量全部（上限 1000）');
  assert.match(html, /<span class="nw">填 0 则尽量全部下载，<\/span>/, '「填 0 则尽量全部下载」整句不断行');
  const { normalizeAnswerCount, MIN_ANSWER_NOTE } = await import('../lib/answer-limit.js');
  assert.deepEqual(normalizeAnswerCount('0'), { value: 0, note: '' }, '0 原样保存为哨兵值');
  for (const v of ['-1', '0.5']) assert.deepEqual(normalizeAnswerCount(v), { value: 1, note: MIN_ANSWER_NOTE }, `${v} 存成 1`);
  assert.match(MIN_ANSWER_NOTE, /0/, '低于 1 的提示里提到 0 是合法值');
  const feed = read('content/modules/exporters/feed.js');
  assert.match(feed, /maxItemCount === 0 \? MAX_ANSWER_LIMIT : maxItemCount/, '导出时 0 按上限 1000 处理');
  console.log('answer count zero sentinel passed');
}
