// 悬浮球深色取值（三态对 #191b1f/#121212 ≥3.4，白色图标 ≥4.5，深色悬停/按下变亮）（R13 球底色 + B2 提示框）：两种深色判定都要覆盖，且对比度达标
import assert from 'assert';
import fs from 'fs';
const css = fs.readFileSync(new URL('../content/content.css', import.meta.url), 'utf8');

function block(re, label) {
  const m = css.match(re);
  assert.ok(m, `content.css 缺少 ${label}`);
  const vars = {};
  for (const [, k, v] of m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[k] = v.trim();
  return vars;
}
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => p - q); return (y + 0.05) / (x + 0.05); };
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');

const base = block(/#zhihu-md-floating-ball \{([^}]*)\}/, '#zhihu-md-floating-ball 基础 token');
const zhihuDark = block(/R13 \/ B2[\s\S]*?html\[data-theme="dark"\] #zhihu-md-floating-ball \{([^}]*)\}/, '知乎夜间模式下的球底色块');
const sysDark = block(/@media \(prefers-color-scheme: dark\) \{\s*html:not\(\[data-theme="light"\]\) #zhihu-md-floating-ball \{([^}]*)\}/, '系统深色下的球底色/提示框块');
const nightOld = block(/html\[data-theme="dark"\] #zhihu-md-floating-ball \{([^}]*--text-primary[^}]*)\}/, '夜间模式提示框 token');

// 球本体与状态都走变量
for (const [sel, v] of [['#zhihu-md-floating-ball:hover \\{', '--ball-bg-hover'], ['#zhihu-md-floating-ball:active \\{', '--ball-bg-active']])
  assert.match(css, new RegExp(sel + '[^}]*background: var\\(' + v + '\\)'), `${sel} 要用 ${v}`);
assert.match(css, /Zhihu Blue Theme \*\/\n {2}background: var\(--ball-bg\);/, '球底色要用 --ball-bg');

for (const [name, d] of [['知乎夜间模式', zhihuDark], ['系统深色', sysDark]]) {
  assert.strictEqual(d['--ball-bg'], '#1a6ae0', `${name}：球底色为设计裁定的 #1a6ae0`);
  assert.strictEqual(d['--ball-fg'], '#FFFFFF', `${name}：球上图标白色`);
  for (const k of ['--ball-bg', '--ball-bg-hover', '--ball-bg-active']) {
    for (const page of ['#191b1f', '#121212']) assert.ok(ratio(d[k], page) >= 3.4, `${name} ${k} ${d[k]} 对 ${page} 只有 ${ratio(d[k], page).toFixed(2)}`);
    assert.ok(ratio(d[k], '#ffffff') >= 4.5, `${name} ${k} 白字对比度不足 4.5`);
  }
  assert.strictEqual(d['--ball-bg-hover'], '#2a73e0', `${name}：悬停色为设计给定的 #2a73e0`);
  assert.strictEqual(d['--ball-bg-active'], '#1f6fe5', `${name}：按下色为设计给定的 #1f6fe5`);
  assert.ok(lum(d['--ball-bg-hover']) > lum(d['--ball-bg']) && lum(d['--ball-bg-active']) > lum(d['--ball-bg']), `${name}：深色下悬停/按下要比静止更亮`);
}
// 两种判定取值一致
for (const k of ['--ball-bg', '--ball-bg-hover', '--ball-bg-active', '--ball-fg']) assert.strictEqual(zhihuDark[k], sysDark[k], `${k} 两种深色判定不一致`);
for (const k of ['--bg-secondary', '--text-primary', '--border-subtle']) assert.strictEqual(sysDark[k], nightOld[k], `提示框 ${k} 系统深色和夜间模式不一致`);
// 亮色加深方向（作为对照）
assert.ok(lum(base['--accent-hover']) < lum(base['--accent']), '亮色悬停为加深');

// 提示框：背景是 90% token + 10% 页面，文字 ≥4.5（AA）
for (const page of ['#191b1f', '#121212']) {
  const bg = mix(sysDark['--bg-secondary'], page, 0.9);
  assert.ok(ratio(sysDark['--text-primary'], bg) >= 4.5, `深色提示框文字对比度 ${ratio(sysDark['--text-primary'], bg).toFixed(2)}`);
}
assert.ok(ratio(base['--text-primary'], mix(base['--bg-secondary'], '#ffffff', 0.9)) >= 4.5, '亮色提示框文字对比度');
console.log('ball dark token tests passed');
