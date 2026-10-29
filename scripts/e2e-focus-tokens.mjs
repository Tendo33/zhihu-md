// L-07 焦点环 e2e：真实 Chrome 加载 dist/，用 Tab 键聚焦（:focus-visible），逐个控件量焦点环。
// 遍历页面上全部可聚焦控件，focus({focusVisible:true})（未就绪时禁用的主按钮临时启用，只量样式）。
// 断言（深色，显式 data-theme=dark 和系统深色两种）：outline 单层 solid 2px、颜色 #93c5fd（≠ --brand #60a5fa）、
//   聚焦前后 box-shadow 不变；截图取像素，环四边中点各取「环 / 环外 1px / 环内 1px」，对比度都要 ≥3:1
//   （蓝色主按钮、相邻控件都在环外、环内的取样点里）。浅色只量对比度和单层 2px，颜色仍是 --brand。
// 用法：CHROME_PATH=/usr/bin/google-chrome（正式版即可） E2E_PLAYWRIGHT_DIR=/path/with/playwright xvfb-run -a node scripts/e2e-focus-tokens.mjs
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
  console.error('e2e-focus: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR'); process.exit(2);
}
if (!process.env.CHROME_PATH || !fs.existsSync(process.env.CHROME_PATH)) { console.error('e2e-focus: 请设置 CHROME_PATH'); process.exit(2); }
if (!fs.existsSync(path.join(dist, 'manifest.json'))) { console.error(`e2e-focus: 找不到 ${dist}/manifest.json`); process.exit(2); }
const { chromium } = loadPlaywright();
if (shots) fs.mkdirSync(shots, { recursive: true });

const FOCUS_DARK = 'rgb(147, 197, 253)';
const MODES = ['light', 'dark-attr', 'dark-sys'];
const PAGES = [['popup/popup.html', [320, 375]], ['options/options.html', [375, 1280]]];
const rows = []; const failures = []; const md5s = {}; // md5s：整张截图；row.ringMd5：只含焦点环（控件 ±6px）
const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

for (const mode of MODES) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-focus-'));
  const ctx = await chromium.launchPersistentContext(prof, {
    headless: false, executablePath: process.env.CHROME_PATH, locale: 'zh-CN',
    env: { ...process.env, LANG: 'zh_CN.UTF-8', LANGUAGE: 'zh_CN' }, colorScheme: mode === 'dark-sys' ? 'dark' : 'light',
    viewport: { width: 375, height: 800 }, deviceScaleFactor: 1, ignoreDefaultArgs: ['--disable-extensions'],
    // 正式版 Chrome 不认 --load-extension，改用 CDP Extensions.loadUnpacked（需 --enable-unsafe-extension-debugging）
    args: ['--enable-unsafe-extension-debugging', '--lang=zh-CN', '--no-first-run'],
  });
  try {
    const cdp = await ctx.browser().newBrowserCDPSession(); const { id } = await cdp.send('Extensions.loadUnpacked', { path: dist });
    const page = await ctx.newPage();
    for (const [rel, widths] of PAGES) {
      for (const vw of widths) {
        await page.setViewportSize({ width: vw, height: 800 });
        await page.goto(`chrome-extension://${id}/${rel}`); await page.waitForTimeout(800);
        // 深色截图显式设置 data-theme（不靠页面自己的主题逻辑）
        await page.evaluate((m) => { const h = document.documentElement; if (m === 'dark-attr') h.setAttribute('data-theme', 'dark'); else if (m === 'light') h.setAttribute('data-theme', 'light'); else h.removeAttribute('data-theme'); }, mode);
        // 关掉过渡：临时启用的主按钮底色有 transition，截图会取到中间色，md5 不稳定
        await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
        const theme = await page.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), brand: getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(), focus: getComputedStyle(document.documentElement).getPropertyValue('--focus').trim() }));
        await page.evaluate(() => { window.__bs = new Map([...document.querySelectorAll('*')].map((e) => [e, getComputedStyle(e).boxShadow])); document.activeElement?.blur(); });
        // 逐个可聚焦控件 focus({focusVisible:true})；未就绪时禁用的主按钮也临时启用来量（只量样式）
        const n = await page.evaluate(() => { window.__fc = [...document.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter((e) => e.getClientRects().length); window.__fc.forEach((e) => { if (e.disabled) { e.disabled = false; e.dataset.e2eWasDisabled = '1'; } }); return window.__fc.length; });
        for (let i = 0; i < n; i++) {
          const m = await page.evaluate((i) => {
            const e = window.__fc[i]; e.focus({ focusVisible: true });
            if (document.activeElement !== e) return null;
            // 开关：input 透明，焦点环画在后面的 span 上
            const ring = e.matches('.switch input') ? e.nextElementSibling : e;
            const r = ring.getBoundingClientRect(); if (!r.width || !r.height) return null;
            const cs = getComputedStyle(ring);
            const key = (e.id || `${e.tagName}.${e.className}`) + (ring !== e ? '+span' : '') + (e.dataset.e2eWasDisabled ? '(disabled)' : '');
            const cls = ring.className || ''; const primary = /btn-primary|\bprimary\b/.test(cls) || getComputedStyle(ring).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
            ring.dataset.e2eRing = '1';
            return { key, cls: String(cls).slice(0, 40), primary, fv: e.matches(':focus-visible'), os: cs.outlineStyle, ow: cs.outlineWidth, oc: cs.outlineColor, oo: parseFloat(cs.outlineOffset), bs: cs.boxShadow, bs0: window.__bs.get(ring) ?? null,
              r: { l: r.left, t: r.top, w: r.width, h: r.height }, bg: cs.backgroundColor, inView: true };
          }, i);
          if (!m) continue;
          const cell = `${mode} ${rel} ${vw} ${m.key}`;
          const row = { mode, page: rel, vw, theme, ...m }; rows.push(row);
          if (!m.fv || m.os === 'none') continue; // 非键盘焦点样式（如 input 文字框的原生样式）不在本测范围
          if (m.os !== 'solid' || m.ow !== '2px') failures.push(`${cell}: outline 不是单层 solid 2px（${m.os} ${m.ow}）`);
          if (m.bs !== m.bs0) failures.push(`${cell}: 聚焦后加了 box-shadow（${m.bs0} → ${m.bs}）`);
          if (mode !== 'light') {
            if (m.oc !== FOCUS_DARK) failures.push(`${cell}: 深色焦点色 ${m.oc}，应为 ${FOCUS_DARK}`);
            if (theme.focus === theme.brand) failures.push(`${cell}: --focus 等于 --brand（${theme.focus}）`);
          }
          if (!m.inView) { await page.evaluate(() => document.querySelector('[data-e2e-ring]')?.removeAttribute('data-e2e-ring')); continue; }
          await page.evaluate(() => document.querySelector('[data-e2e-ring]').scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(40);
          const rr = await page.evaluate(() => { const g = document.querySelector('[data-e2e-ring]'); const r = g.getBoundingClientRect(); delete g.dataset.e2eRing; return { l: r.left, t: r.top, w: r.width, h: r.height }; });
          const png = await page.screenshot();
          if (shots) { const f = path.join(shots, `${mode}-${rel.split('/')[0]}-${vw}-${m.key.replace(/[^\w+-]/g, '_')}.png`); fs.writeFileSync(f, png); md5s[path.basename(f)] = crypto.createHash('md5').update(png).digest('hex'); }
          const w = parseFloat(m.ow); const o = m.oo;
          // 四边中点：环中心、环外 1px、环内 1px（offset 区，紧贴环）
          const pts = [];
          const cy = rr.t + rr.h / 2; const cx = rr.l + rr.w / 2;
          pts.push(['L', [rr.l - o - w / 2, cy], [rr.l - o - w - 1, cy], [rr.l - o + 0.5, cy]]);
          pts.push(['R', [rr.l + rr.w + o + w / 2, cy], [rr.l + rr.w + o + w + 1, cy], [rr.l + rr.w + o - 0.5, cy]]);
          pts.push(['T', [cx, rr.t - o - w / 2], [cx, rr.t - o - w - 1], [cx, rr.t - o + 0.5]]);
          pts.push(['B', [cx, rr.t + rr.h + o + w / 2], [cx, rr.t + rr.h + o + w + 1], [cx, rr.t + rr.h + o - 0.5]]);
          const px = await page.evaluate(async ({ b64, pts, rr }) => {
            const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            const get = ([x, y]) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null; return [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]; };
            const x0 = Math.max(0, Math.floor(rr.l - 6)); const y0 = Math.max(0, Math.floor(rr.t - 6));
            const crop = [...g.getImageData(x0, y0, Math.min(c.width - x0, Math.ceil(rr.w + 12)), Math.min(c.height - y0, Math.ceil(rr.h + 12))).data].join(',');
            return { crop, pts: pts.map(([s, ring, out, inn]) => ({ s, ring: get(ring), out: get(out), inn: get(inn) })) };
          }, { b64: png.toString('base64'), pts, rr }).then((v) => { row.ringMd5 = crypto.createHash('md5').update(v.crop).digest('hex'); return v.pts; });
          row.px = px; row.minCr = Infinity;
          for (const p of px) {
            if (!p.ring) continue;
            for (const k of ['out', 'inn']) {
              if (!p[k]) continue;
              const v = cr(p.ring, p[k]); row.minCr = Math.min(row.minCr, v);
              if (v < 3) failures.push(`${cell}: 焦点环${p.s}边 rgb(${p.ring}) 对${k === 'out' ? '环外' : '环内'} rgb(${p[k]}) 对比度 ${v.toFixed(2)} < 3`);
            }
          }
          row.minCr = +row.minCr.toFixed(2);
        }
      }
    }
  } finally { await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); }
}
const measured = rows.filter((r) => r.minCr !== undefined);
for (const mode of MODES) if (!measured.some((r) => r.mode === mode)) failures.push(`${mode}: 一个焦点环都没量到`);
if (process.env.E2E_OUT) fs.writeFileSync(process.env.E2E_OUT, JSON.stringify({ rows, md5s, failures }, null, 1));
for (const r of measured) console.log(`${r.mode.padEnd(9)} ${r.page.padEnd(20)} ${String(r.vw).padStart(4)} ${(r.key + (r.primary ? ' [主按钮]' : '')).slice(0, 40).padEnd(40)} ${r.oc} ${r.ow} min ${r.minCr}`);
if (shots) for (const [f, h] of Object.entries(md5s)) console.log(`md5 ${h} ${f}`);
for (const r of measured) console.log(`ring-md5 ${r.ringMd5} ${r.mode} ${r.page} ${r.vw} ${r.key}`);
if (failures.length) { console.error(`e2e-focus FAIL ${failures.length}\n${failures.join('\n')}`); process.exit(1); }
console.log(`e2e-focus-tokens passed (${measured.length} 个焦点环)`);
