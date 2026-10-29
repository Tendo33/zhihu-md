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
const STATES = ['idle', 'docked-left', 'docked-right'];
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
      const cell = `${theme} ${state}`;
      await page.goto('https://zhuanlan.zhihu.com/p/300');
      await page.waitForSelector('#zhihu-md-floating-ball', { timeout: 20000 });
      // 显式设置 data-theme 和知乎页面底色；关掉过渡，量到的是终值
      await page.evaluate(([attr, bg]) => { document.documentElement.setAttribute('data-theme', attr); document.documentElement.style.background = bg; document.body.style.background = bg; }, [T.attr, T.bg]);
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      await page.evaluate((st) => {
        const b = document.getElementById('zhihu-md-floating-ball'); b.classList.remove('docked-left', 'docked-right');
        if (st !== 'idle') b.classList.add(st);
        // 球放在视口中部，环四边都在屏内，可以取像素
        b.style.setProperty('top', '300px', 'important'); if (st === 'idle') { b.style.setProperty('left', '600px', 'important'); b.style.setProperty('right', 'auto', 'important'); }
        document.activeElement?.blur();
      }, state);
      await page.mouse.move(5, 5);
      const read = () => page.evaluate(() => { const b = document.getElementById('zhihu-md-floating-ball'); const s = getComputedStyle(b); const r = b.getBoundingClientRect(); return { boxShadow: s.boxShadow, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset, outlineColor: s.outlineColor, w: b.offsetWidth, h: b.offsetHeight, rect: [r.left, r.top, r.width, r.height], fv: b.matches(':focus-visible'), bg: s.backgroundColor }; });
      const before = await read();
      await page.evaluate(() => document.getElementById('zhihu-md-floating-ball').focus({ focusVisible: true }));
      await page.waitForTimeout(150);
      const after = await read();
      if (!after.fv) fail(cell, '没有进入 :focus-visible');
      if (after.outlineStyle !== 'solid') fail(cell, `outline-style ${after.outlineStyle}`);
      if (after.outlineWidth !== '2px') fail(cell, `outline-width ${after.outlineWidth}`);
      if (after.outlineOffset !== '2px') fail(cell, `outline-offset ${after.outlineOffset}`);
      if (after.outlineColor !== T.ring) fail(cell, `outline-color ${after.outlineColor} ≠ ${T.ring}`);
      if (after.boxShadow !== before.boxShadow) fail(cell, `box-shadow 变了：${before.boxShadow} → ${after.boxShadow}`);
      if (after.w !== before.w || after.h !== before.h) fail(cell, `尺寸变了 ${before.w}x${before.h} → ${after.w}x${after.h}`);
      // 像素：环在 [边-4, 边-2) 之间，取环中线、环外 3px、缝（环与球之间 1px）
      const buf = await page.screenshot();
      const png = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext('2d'); g.drawImage(img, 0, 0); return { w: img.width, d: Array.from(g.getImageData(0, 0, img.width, img.height).data) }; }, buf.toString('base64'));
      const px = (x, y) => { x = Math.round(x); y = Math.round(y); const i = (y * png.w + x) * 4; return [png.d[i], png.d[i + 1], png.d[i + 2]]; };
      const [vw, vh] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.clientHeight]); // 滚动条下面的像素不算页面
      const [L, Tp, W, H] = after.rect; const cx = L + W / 2; const cy = Tp + H / 2;
      const sides = { top: [cx, Tp, 0, -1], bottom: [cx, Tp + H, 0, 1], left: [L, cy, -1, 0], right: [L + W, cy, 1, 0] };
      const samples = {}; let minRing = Infinity;
      for (const [k, [x0, y0, dx, dy]] of Object.entries(sides)) {
        const at = (d) => [x0 + dx * d - (dx === 0 ? 0 : 0.5) , y0 + dy * d - (dy === 0 ? 0 : 0.5)];
        const ring = at(3.5).map(Math.floor); const out = at(7.5).map(Math.floor); const gap = at(1.5).map(Math.floor);
        if ([ring, out, gap].some(([x, y]) => x < 0 || y < 0 || x >= vw || y >= vh)) { samples[k] = 'off-screen（收边贴视口边，这一侧环在视口外）'; continue; }
        const [cR, cO, cG] = [px(...ring), px(...out), px(...gap)];
        const o = { ring: cR, out: cO, gap: cG, crOut: +cr(cR, cO).toFixed(2), crGap: +cr(cR, cG).toFixed(2) };
        samples[k] = o; minRing = Math.min(minRing, o.crOut, o.crGap);
        if (o.crOut < 3 || o.crGap < 3) fail(cell, `${k} 对比度 ${o.crOut}/${o.crGap} < 3`);
      }
      const bg = T.bg.match(/\w\w/g).map((h) => parseInt(h, 16)); const ringRgb = after.outlineColor.match(/\d+/g).map(Number);
      const crSpec = +cr(ringRgb, bg).toFixed(2); const ballRgb = after.bg.match(/\d+/g).slice(0, 3).map(Number); const crBall = +cr(ringRgb, ballRgb).toFixed(2);
      let shot = null; let ringMd5 = null;
      if (shots) {
        const f = path.join(shots, `ball-${theme}-${state}.png`); fs.writeFileSync(f, buf); shot = crypto.createHash('md5').update(buf).digest('hex');
        const crop = await page.screenshot({ clip: { x: Math.max(0, L - 10), y: Math.max(0, Tp - 10), width: Math.min(W + 20, 1280 - Math.max(0, L - 10)), height: H + 20 } });
        fs.writeFileSync(path.join(shots, `ball-${theme}-${state}-ring.png`), crop); ringMd5 = crypto.createHash('md5').update(crop).digest('hex');
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
