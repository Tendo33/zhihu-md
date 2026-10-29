// R12：悬浮球提示到视口四边 ≥ 8px，球在任何位置都成立；1280 下默认位置一行；只在「·」后折行
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chooseLayout, EDGE, HOVER_LIFT } from '../content/modules/tooltip-layout.js';

// 用实测字宽模拟排版（Chromium 12px system-ui，见 dev-log v8 矩阵）：两个不换行短语 + 空格
const PHRASES = {
  en: [100.4, 113.9, 3.8], // "Click to export ·"、"Right-click to copy"、空格
  zh: [57.1, 48.0, 3.4],
};
const PAD = 20 + 2; // padding 6px 10px + 边框 1px
const LINE = 18; const VPAD = 12 + 2;
function measureFor([a, b, sp]) {
  return (maxWidth) => {
    const one = a + sp + b + PAD;
    if (one <= maxWidth) return { tw: one, th: LINE + VPAD, fits: true, lines: 1 };
    const two = Math.max(a, b) + PAD;
    return { tw: Math.min(two, Math.max(maxWidth, two)), th: 2 * LINE + VPAD, fits: two <= maxWidth, lines: 2 };
  };
}

const BALL = 44;
const rows = [];
for (const lang of ['en', 'zh']) {
  for (const vw of [320, 375, 1280]) {
    for (const vh of [568, 800]) {
      const positions = {
        default: { left: vw - 24 - BALL, top: vh - 24 - BALL },
        leftmost: { left: 0, top: vh / 2 },
        top: { left: vw - 24 - BALL, top: 0 },
        bottom: { left: vw - 24 - BALL, top: vh - BALL },
        middle: { left: vw / 2 - BALL / 2, top: vh / 2 },
        topLeft: { left: 0, top: 0 },
        bottomLeft: { left: 0, top: vh - BALL },
      };
      // 再扫一遍所有水平位置（步长 4px），覆盖“拖到任意位置”
      for (let x = 0; x <= vw - BALL; x += 4) positions[`x${x}`] = { left: x, top: vh / 3 };
      for (const [pos, p] of Object.entries(positions)) {
        const ball = { ...p, width: BALL, height: BALL };
        const r = chooseLayout({ ball, vw, vh, measure: measureFor(PHRASES[lang]) });
        const m = { l: r.left, r: vw - r.left - r.tw, t: r.top - HOVER_LIFT, b: vh - r.top - r.th };
        rows.push({ lang, vw, vh, pos, ...r, m });
        for (const [side, d] of Object.entries(m)) assert.ok(d >= EDGE - 0.01, `${lang} ${vw}x${vh} ${pos} ${side}=${d.toFixed(1)} < 8`);
        assert.ok(r.fits, `${lang} ${vw} ${pos} 短语放不下`);
        // 不压在球上
        const overlapX = r.left < ball.left + BALL && r.left + r.tw > ball.left;
        const overlapY = r.top < ball.top + BALL && r.top + r.th > ball.top;
        assert.ok(!(overlapX && overlapY), `${lang} ${vw} ${pos} 提示压在球上`);
      }
    }
  }
}
// 1280 默认位置一行；球在中间也一行
for (const r of rows.filter((x) => x.vw === 1280 && ['default', 'middle', 'leftmost'].includes(x.pos))) assert.equal(r.lines, 1, `1280 ${r.pos} 应为一行`);
// 两行时高 50（48 + 上下边框 2）；吸左/最左时放右侧
for (const r of rows.filter((x) => x.lines === 2)) assert.equal(r.th, 2 * LINE + VPAD);
for (const r of rows.filter((x) => x.pos === 'leftmost')) assert.equal(r.placement, 'right');
for (const r of rows.filter((x) => x.pos === 'default')) assert.equal(r.placement, 'left');
// 球中心在左半屏时放右侧、右半屏时放左侧（1280 宽两侧都放得下，必须按半屏选）
for (const r of rows.filter((x) => x.vw === 1280 && /^x\d+$/.test(x.pos))) {
  const cx = Number(r.pos.slice(1)) + BALL / 2;
  assert.equal(r.placement, cx > 640 ? 'left' : 'right', `1280 ${r.pos} 侧边`);
}
// 320 宽默认位置英文要折行（一行 240px 放不下 228px 的可用宽度）
assert.equal(rows.find((x) => x.lang === 'en' && x.vw === 320 && x.pos === 'default').lines, 2);

// CSS：去掉整行 nowrap，行高 18，左对齐，.nw 不换行，transform 走变量
const css = fs.readFileSync(new URL('../content/content.css', import.meta.url), 'utf8');
const tipRule = css.match(/#zhihu-md-floating-ball \.tooltip \{[^}]*\}/)[0];
assert.ok(!/white-space:\s*nowrap/.test(tipRule), 'tooltip 不能整行 nowrap');
assert.match(tipRule, /line-height:\s*18px/);
assert.match(tipRule, /text-align:\s*left/);
assert.match(tipRule, /padding:\s*6px 10px/);
assert.match(tipRule, /max-width:/);
assert.match(css, /\.tooltip \.nw \{\s*white-space:\s*nowrap;/);
console.log(`tooltip layout tests passed (${rows.length} 组合)`);
