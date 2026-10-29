// L-07 悬浮球焦点环 e2e：真实 Chrome 加载 dist/，在知乎 fixture 页上量 #zhihu-md-floating-ball 的 :focus-visible。
// 断言（computed style）：outline solid 2px、outline-offset 2px、颜色（深色 #93c5fd，浅色 #0a5fd1）；
//   聚焦前后 box-shadow 完全一致、球的尺寸不变（普通 / 收边左 / 收边右三种状态）。
// 对比度：截图取像素，环的上、下、左、右中点各取「环 / 环外 / 环与球之间的缝」，环对页面背景都要 ≥3:1。
// 深色显式设置 html[data-theme=dark]，页面底色用知乎夜间模式背景 #121212；浅色显式 data-theme=light、白底。
// 用法：CHROME_PATH=/usr/bin/google-chrome E2E_PLAYWRIGHT_DIR=/path/with/playwright xvfb-run -a node scripts/e2e-ball-focus.mjs
//   可选：E2E_DIST（默认 dist/）、E2E_SHOTS=目录（每组一张截图，打印 md5）、E2E_OUT=结果 JSON
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(process.env.E2E_DIST || path.join(root, 'dist'));
const shots = process.env.E2E_SHOTS || '';
function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e-ball-focus: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR'); process.exit(2);
}
if (!process.env.CHROME_PATH || !fs.existsSync(process.env.CHROME_PATH)) { console.error('e2e-ball-focus: 请设置 CHROME_PATH'); process.exit(2); }
if (!fs.existsSync(path.join(dist, 'manifest.json'))) { console.error(`e2e-ball-focus: 找不到 ${dist}/manifest.json`); process.exit(2); }
const { chromium } = loadPlaywright();
if (shots) fs.mkdirSync(shots, { recursive: true });

const THEMES = { light: { attr: 'light', bg: '#ffffff', ring: 'rgb(10, 95, 209)' }, dark: { attr: 'dark', bg: '#121212', ring: 'rgb(147, 197, 253)' } };
// R12：收边左/右在「有滚动条」和「无滚动条（overflow hidden）」两种页面上都要四边环完整可见
// ZF-01：真实知乎有 `:focus{outline:none !important}`；zhihu / star 两格注入这条（及 `*:focus{outline:0!important}` 变体），用键盘 Tab 聚焦后按像素断言环在
const STATES = ['idle', 'docked-left', 'docked-right', 'docked-left noscroll', 'docked-right noscroll', 'idle zhihu', 'idle star', 'docked-right zhihu', 'snap-right zhihu', 'snap-right noscroll', 'snap-bottom zhihu', 'snap-bottom noscroll'];
// snap-bottom：拖到底边中间（不吸边），y 必须 = clientHeight - h - 4，环下缘 ≤ clientHeight
// snap-right：真的用鼠标拖到右边（有滚动条），走 JS 的 clamp/handleSnapAndDock，吸边后的 left 必须是 clientWidth - w，再等 800ms 收边
// 可选 E2E_STATES=逗号分隔，只跑部分格（例如回滚检查只跑 ZF-01 的格）
if (process.env.E2E_STATES) { const keep = process.env.E2E_STATES.split(','); STATES.splice(0, STATES.length, ...STATES.filter((x) => keep.includes(x))); }
const RESETS = { zhihu: ':focus{outline:none !important}', star: '*:focus{outline:0!important}' };
const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const rows = []; const failures = [];
const fail = (cell, msg) => { failures.push(`${cell}: ${msg}`); };

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-ball-focus-'));
const ctx = await chromium.launchPersistentContext(prof, {
  headless: false, executablePath: process.env.CHROME_PATH, locale: 'zh-CN',
  env: { ...process.env, LANG: 'zh_CN.UTF-8', LANGUAGE: 'zh_CN' },
  viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ignoreDefaultArgs: ['--disable-extensions'],
  args: ['--enable-unsafe-extension-debugging', '--lang=zh-CN', '--no-first-run'],
});
try {
  const cdp = await ctx.browser().newBrowserCDPSession(); await cdp.send('Extensions.loadUnpacked', { path: dist });
  await ctx.route('https://zhuanlan.zhihu.com/p/300', (r) => r.fulfill({ path: path.join(root, 'tests/fixtures/article-tables.html'), contentType: 'text/html; charset=utf-8' }));
  const page = await ctx.newPage();
  for (const [theme, T] of Object.entries(THEMES)) {
    for (const state of STATES) {
      const cell = `${theme} ${state}`; const [st0, noscroll] = [state.split(' ')[0], state.endsWith('noscroll')]; const reset = RESETS[state.split(' ')[1]] || '';
      await page.goto('https://zhuanlan.zhihu.com/p/300', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#zhihu-md-floating-ball', { timeout: 20000 });
      // 显式设置 data-theme 和知乎页面底色；关掉过渡，量到的是终值
      await page.evaluate(([attr, bg]) => { document.documentElement.setAttribute('data-theme', attr); document.documentElement.style.background = bg; document.body.style.background = bg; }, [T.attr, T.bg]);
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} body *:not([id^=zhihu-md]):not([id^=zhihu-md] *):not([class*=zhihu-md]):not([class*=zhihu-md] *){visibility:hidden!important}' }); // 隐藏正文，采样不落在文字上
      if (reset) await page.addStyleTag({ content: reset }); // 知乎站点的焦点重置，挂在页面里，和真实知乎一样
      if (noscroll) await page.evaluate(() => { document.documentElement.style.overflow = 'hidden'; });
      await page.evaluate((st) => {
        const b = document.getElementById('zhihu-md-floating-ball'); b.classList.remove('docked-left', 'docked-right');
        if (!['idle', 'snap-right', 'snap-bottom'].includes(st)) b.classList.add(st);
        // 球放在视口中部，环四边都在屏内，可以取像素
        b.style.setProperty('top', '300px', 'important'); if (st === 'idle') { b.style.setProperty('left', '600px', 'important'); b.style.setProperty('right', 'auto', 'important'); }
        document.activeElement?.blur();
      }, st0);
      await page.mouse.move(640, 5);
      if (st0 === 'snap-bottom') {
        await page.evaluate(() => { const b = document.getElementById('zhihu-md-floating-ball'); b.style.removeProperty('top'); b.style.left = '600px'; b.style.top = '300px'; b.style.right = 'auto'; b.style.bottom = 'auto'; });
        const r0 = await page.evaluate(() => { const r = document.getElementById('zhihu-md-floating-ball').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        await page.mouse.move(r0[0], r0[1]); await page.mouse.down(); await page.mouse.move(r0[0], 700, { steps: 5 }); await page.mouse.move(r0[0], 799, { steps: 5 }); await page.mouse.up();
        const [top, ch, bh] = await page.evaluate(() => { const b = document.getElementById('zhihu-md-floating-ball'); return [parseFloat(b.style.top), document.documentElement.clientHeight, b.offsetHeight]; });
        if (top !== ch - bh - 4) fail(cell, `拖到底边后 top ${top} ≠ clientHeight ${ch} - ${bh} - 4`);
        await page.mouse.move(640, 5); await page.waitForTimeout(1000);
      }
      if (st0 === 'snap-right') {
        await page.evaluate(() => document.getElementById('zhihu-md-floating-ball').style.removeProperty('top'));
        await page.evaluate(() => { const b = document.getElementById('zhihu-md-floating-ball'); b.style.left = '600px'; b.style.top = '300px'; b.style.right = 'auto'; b.style.bottom = 'auto'; });
        const r0 = await page.evaluate(() => { const r = document.getElementById('zhihu-md-floating-ball').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        await page.mouse.move(r0[0], r0[1]); await page.mouse.down(); await page.mouse.move(r0[0] + 300, r0[1], { steps: 5 }); await page.mouse.move(1279, r0[1], { steps: 5 }); await page.mouse.up();
        const [snapL, cw, bw0] = await page.evaluate(() => { const b = document.getElementById('zhihu-md-floating-ball'); return [parseFloat(b.style.left), document.documentElement.clientWidth, b.offsetWidth]; });
        if (snapL !== cw - bw0 - 4) fail(cell, `吸右后 left ${snapL} ≠ clientWidth ${cw} - ${bw0} - 4（压在滚动条下或没留 4px）`);
        await page.mouse.move(640, 5); await page.waitForTimeout(1000);
        if (!(await page.evaluate(() => document.getElementById('zhihu-md-floating-ball').classList.contains('docked-right')))) fail(cell, '拖到右边后没有收边');
      }
      const read = () => page.evaluate(() => { const b = document.getElementById('zhihu-md-floating-ball'); const s = getComputedStyle(b); const r = b.getBoundingClientRect(); return { boxShadow: s.boxShadow, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, outlineColor: s.outlineColor, w: b.offsetWidth, h: b.offsetHeight, rect: [r.left, r.top, r.width, r.height], fv: b.matches(':focus-visible'), bg: s.backgroundColor }; });
      const before = await read();
      const [vw, vh, sbw] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.clientHeight, window.innerWidth - document.documentElement.clientWidth]);
      if (noscroll !== (sbw === 0)) fail(cell, `滚动条宽 ${sbw}，与用例不符`);
      // 常态位置不动：收边仍是贴 clientWidth 边、露出 60%
      const [bl, , bw] = before.rect;
      if (st0 === 'docked-left' && Math.abs(bl - -0.4 * bw) > 0.5) fail(cell, `常态位置变了 left ${bl}`);
      if ((st0 === 'docked-right' || st0 === 'snap-right') && Math.abs(bl - (vw - 0.6 * bw)) > 0.5) fail(cell, `常态位置变了 left ${bl}（clientWidth ${vw}）`);
      if (reset) {
        // 键盘 Tab：正文已 visibility:hidden，不可聚焦；最多按 40 次直到焦点落到球上
        for (let i = 0; i < 40 && !(await page.evaluate(() => document.activeElement?.id === 'zhihu-md-floating-ball')); i++) await page.keyboard.press('Tab');
        if (!(await page.evaluate(() => document.activeElement?.id === 'zhihu-md-floating-ball'))) fail(cell, 'Tab 没能聚焦到悬浮球');
      } else await page.evaluate(() => document.getElementById('zhihu-md-floating-ball').focus({ focusVisible: true }));
      await page.waitForTimeout(150);
      const after = await read();
      if (!after.fv) fail(cell, '没有进入 :focus-visible');
      if (after.outlineStyle !== 'solid') fail(cell, `outline-style ${after.outlineStyle}`);
      if (after.outlineWidth !== '2px') fail(cell, `outline-width ${after.outlineWidth}`);
      if (after.outlineOffset !== '2px') fail(cell, `outline-offset ${after.outlineOffset}`);
      if (after.outlineColor !== T.ring) fail(cell, `outline-color ${after.outlineColor} ≠ ${T.ring}`);
      if (after.boxShadow !== before.boxShadow) fail(cell, `box-shadow 变了：${before.boxShadow} → ${after.boxShadow}`);
      { const [al, at, aw, ah] = after.rect; if (al - 4 < 0 || at - 4 < 0 || al + aw + 4 > vw || at + ah + 4 > vh) fail(cell, `聚焦环外缘超出可见区 [${al - 4}, ${al + aw + 4}] / clientWidth ${vw}`); }
      // 必改 1：聚焦时位移正好 4px（左停靠 +4、右停靠 -4，其余 0），静止时 x 不变（上面已断言常态位置）
      { const cls = await page.evaluate(() => document.getElementById('zhihu-md-floating-ball').className); const [al, , aw] = after.rect; const d = al - before.rect[0];
        // 设计必改 1：停靠时聚焦 → translateX(±4px)，球离视口边正好 4px（相对静止的 ±40% 露出位，位移 = 0.4w + 4）；没停靠时 x 不动
        if (/docked-left/.test(cls)) { if (Math.abs(al - 4) > 0.01) fail(cell, `聚焦后左边 ${al} ≠ 4（离边 4px）`); if (Math.abs(d - (0.4 * aw + 4)) > 0.05) fail(cell, `聚焦位移 ${d} ≠ 0.4w+4`); }
        else if (/docked-right/.test(cls)) { if (Math.abs(vw - (al + aw) - 4) > 0.01) fail(cell, `聚焦后右边离 clientWidth ${vw - (al + aw)} ≠ 4px`); if (Math.abs(d + (0.4 * aw + 4)) > 0.05) fail(cell, `聚焦位移 ${d} ≠ -(0.4w+4)`); }
        else if (Math.abs(d) > 0.01) fail(cell, `未停靠却位移 ${d}px`);
        if (after.rect[1] !== before.rect[1]) fail(cell, `聚焦时 y 变了`); }
      if (after.w !== before.w || after.h !== before.h) fail(cell, `尺寸变了 ${before.w}x${before.h} → ${after.w}x${after.h}`);
      // 像素：环在 [边-4, 边-2) 之间，取环中线、环外 3px、缝（环与球之间 1px）
      const buf = await page.screenshot();
      const png = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0); return { w: img.width, d: Array.from(g.getImageData(0, 0, img.width, img.height).data) }; }, buf.toString('base64'));
      const px = (x, y) => { x = Math.round(x); y = Math.round(y); const i = (y * png.w + x) * 4; return [png.d[i], png.d[i + 1], png.d[i + 2]]; };
      const [L, Tp, W, H] = after.rect; const cx = L + W / 2; const cy = Tp + H / 2;
      const sides = { top: [cx, Tp, 0, -1], bottom: [cx, Tp + H, 0, 1], left: [L, cy, -1, 0], right: [L + W, cy, 1, 0] };
      const samples = {}; let minRing = Infinity;
      for (const [k, [x0, y0, dx, dy]] of Object.entries(sides)) {
        const at = (d) => [x0 + dx * d - (dx === 0 ? 0 : 0.5) , y0 + dy * d - (dy === 0 ? 0 : 0.5)];
        const ring = at(3.5).map(Math.floor); const out = at(7.5).map(Math.floor); const gap = at(1.5).map(Math.floor);
        // R12：不再放宽，环外缘（距球 4px）和环外 3px 的采样点都必须在 clientWidth/clientHeight 内
        const inside = ([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh;
        if (!inside(ring) || !inside(gap)) { fail(cell, `${k} 侧环被视口/滚动条裁切`); samples[k] = 'clipped'; continue; }
        // 贴边时环外只剩 0px 页面（环外缘正好在可见区边上），环外点取不到就只比「环/缝」；环外缘在可见区内由上面的几何断言保证
        const [cR, cG] = [px(...ring), px(...gap)]; const cO = inside(out) ? px(...out) : null;
        const o = { ring: cR, out: cO, gap: cG, crOut: cO ? +cr(cR, cO).toFixed(2) : Infinity, crGap: +cr(cR, cG).toFixed(2) };
        samples[k] = o; minRing = Math.min(minRing, o.crOut, o.crGap);
        if (o.crOut < 3 || o.crGap < 3) fail(cell, `${k} 对比度 ${o.crOut}/${o.crGap} < 3`);
      }
      const bg = T.bg.match(/\w\w/g).map((h) => parseInt(h, 16)); const ringRgb = after.outlineColor.match(/\d+/g).map(Number);
      const crSpec = +cr(ringRgb, bg).toFixed(2); const ballRgb = after.bg.match(/\d+/g).slice(0, 3).map(Number); const crBall = +cr(ringRgb, ballRgb).toFixed(2);
      let shot = null; let ringMd5 = null;
      if (shots) {
        const f = path.join(shots, `ball-${theme}-${state.replace(' ', '-')}.png`); fs.writeFileSync(f, buf); shot = crypto.createHash('md5').update(buf).digest('hex');
        const crop = await page.screenshot({ clip: { x: Math.max(0, L - 10), y: Math.max(0, Tp - 10), width: Math.min(W + 20, vw - Math.max(0, L - 10)), height: H + 20 } });
        fs.writeFileSync(path.join(shots, `ball-${theme}-${state.replace(' ', '-')}-ring.png`), crop); ringMd5 = crypto.createHash('md5').update(crop).digest('hex');
      }
      const row = { cell, before: { boxShadow: before.boxShadow, size: [before.w, before.h] }, after: { ...after }, crSpecVsPageBg: crSpec, crRingVsBallFill: crBall, minSampled: +minRing.toFixed(2), samples, shot, ringMd5 };
      rows.push(row);
      console.log(`${cell}\t${after.outlineStyle} ${after.outlineWidth} off ${after.outlineOffset} ${after.outlineColor}\tshadow ${before.boxShadow === after.boxShadow ? '不变' : '变了'}\t环/页底 ${crSpec}:1\t实测最低 ${row.minSampled}:1\t环/球 ${crBall}:1\tmd5 ${shot || '-'} ring ${ringMd5 || '-'}`);
    }
  }
} finally { await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); }
if (process.env.E2E_OUT) fs.writeFileSync(process.env.E2E_OUT, JSON.stringify({ rows, failures }, null, 2));
if (failures.length) { console.error(`e2e ball focus FAIL（${failures.length}）\n` + failures.join('\n')); process.exit(1); }
console.log('e2e ball focus PASS');
