// 设置页重做（设计 2026-10-29 M1–M7）：开关单旋钮、同行居中、嵌入式对话框、页脚保存提示、标题、数字框、文案、层级与语义
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

// M2：同行居中、卡片随内容、嵌入式对话框
{
  assert.ok(!/@media \(max-width: 480px\) \{\s*\.option-item \{\s*flex-direction: column/.test(css), 'M2：不再在 ≤480 改竖排');
  assert.match(rule('.option-item'), /align-items: center;/);
  assert.match(css, /\nbody \{[^}]*min-height: 100vh;[^}]*align-items: flex-start;/, 'M2：卡片不被拉伸');
  assert.match(css, /html\.embedded body \{[^}]*padding: 0;[^}]*width: 520px;/);
  assert.match(css, /html\.embedded,\s*html\.embedded body \{[^}]*min-height: 0;/);
  const { parseHTML } = await import('linkedom');
  const { window, document } = parseHTML('<!doctype html><html><body><input id="showFloatingBall" type="checkbox"><input id="maxAnswerCount"><input id="downloadImages" type="checkbox"><span id="status"></span><div id="note-maxAnswerCount"></div><span id="app-version"></span></body></html>');
  globalThis.window = window; globalThis.document = document;
  globalThis.chrome = { storage: { sync: { get: (d, cb) => cb(d), set: (_o, cb) => cb && cb() } }, runtime: { getManifest: () => ({ version: '9.9.9' }) } };
  const { markEmbedded } = await import('../options/options.js');
  const root = document.documentElement;
  markEmbedded({ getCurrent: (cb) => cb(undefined) }, root);
  assert.ok(root.classList.contains('embedded'), '嵌入（无所属标签页）→ html.embedded');
  markEmbedded({ getCurrent: (cb) => cb({ id: 1 }) }, root);
  assert.ok(!root.classList.contains('embedded'), '新标签页 → 不加');
  markEmbedded(undefined, root);
  assert.ok(!root.classList.contains('embedded'), '没有 tabs API 时不动');
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
  assert.ok(html.includes('id="desc-showFloatingBall">在知乎首页、关注、热榜、问题、回答和专栏页显示悬浮球：点击下载，右键复制。</div>'));
  assert.ok(html.includes('id="desc-maxAnswerCount">问题页回答和首页、关注信息流通用。填 0 则尽量全部下载，最多 <span class="nw">1000 条</span>；被上限截断的导出会标为 truncated。</div>'));
  assert.ok(html.includes('id="desc-downloadImages">把文章里的图片一起保存，导出为含 .md 和 images 文件夹的 ZIP 包；关闭时图片保留在线链接。</div>'));
  assert.match(rule('.option-desc'), /text-wrap: pretty;/);
  assert.match(rule('.option-desc'), /color: var\(--text-2\);/);
  assert.match(rule('.nw'), /white-space: nowrap;/);
  console.log('options redesign M6 passed');
}

// M7：层级与间距、语义（<label for>、role="switch"、aria-checked 同步）
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
  assert.equal((html.match(/<input type="checkbox" role="switch" aria-checked="false"/g) || []).length, 2);
  assert.equal((html.match(/<span class="slider" aria-hidden="true"><\/span>/g) || []).length, 2);
  // aria-checked 跟随 checked：读取设置时、切换时
  const { parseHTML } = await import('linkedom');
  const page = parseHTML(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  globalThis.window = page.window; globalThis.document = page.document;
  let store = { showFloatingBall: true, maxAnswerCount: 20, downloadImages: false };
  globalThis.chrome = { storage: { sync: { get: (d, cb) => cb({ ...d, ...store }), set: (o, cb) => { store = { ...store, ...o }; cb && cb(); } } } };
  await import('../options/options.js?m7');
  page.document.dispatchEvent(new page.window.Event('DOMContentLoaded'));
  const ball = page.document.getElementById('showFloatingBall');
  const img = page.document.getElementById('downloadImages');
  assert.equal(ball.getAttribute('aria-checked'), 'true', '读取后同步');
  assert.equal(img.getAttribute('aria-checked'), 'false');
  img.checked = true; img.dispatchEvent(new page.window.Event('change'));
  assert.equal(img.getAttribute('aria-checked'), 'true', '切换后同步');
  assert.equal(store.downloadImages, true);
  assert.equal(page.document.getElementById('status').textContent, '✓ 已保存');
  console.log('options redesign M7 passed');
}
