// R12 回归 e2e：真实 Chromium 加载 dist/，在 语言 × 主题 × 宽度 × 球位置 下悬停，量提示到视口四边的距离。
// 断言：四边都 ≥ 8px；1280 宽、默认位置时一行；只在「·」后折行（两行时两段各占一行）。
// 用法：CHROME_PATH=.../chrome E2E_PLAYWRIGHT_DIR=/path/with/playwright xvfb-run -a node scripts/e2e-tooltip-edges.mjs
//   可选：E2E_DIST（默认 dist/）、E2E_SHOTS=目录（每个组合存一张整页截图）、E2E_OUT=结果 JSON 路径
// v9：另跑 en 320 × 四个位置 × 失败 1 / 3 张图，真点导出得到成功提示（"Exported. N image(s) couldn't be downloaded…"），
//   断言同样四边 ≥8，且 "couldn't be downloaded" 是一个不折行段。图片走 *.zhimg.com，用 host-resolver 置空让它下载失败。
// 中文用 LANG=zh_CN.UTF-8 启动 Chrome（Linux 上只给 --lang 仍会显示英文），脚本内部已设置。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.E2E_DIST || path.join(root, 'dist');
const fixture = path.join(root, 'tests/fixtures/answer-long.html');
const shots = process.env.E2E_SHOTS || '';
const EDGE = 8; const VH = 800;

function loadPlaywright() {
  for (const d of [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean)) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e-tooltip: 找不到 playwright，请设置 E2E_PLAYWRIGHT_DIR'); process.exit(2);
}
if (!process.env.CHROME_PATH || !fs.existsSync(process.env.CHROME_PATH)) { console.error('e2e-tooltip: 请设置 CHROME_PATH'); process.exit(2); }
if (!fs.existsSync(path.join(dist, 'manifest.json'))) { console.error(`e2e-tooltip: 找不到 ${dist}/manifest.json，请先 npm run build`); process.exit(2); }
const { chromium } = loadPlaywright();
if (shots) fs.mkdirSync(shots, { recursive: true });

const LANGS = { 'zh-CN': { LANG: 'zh_CN.UTF-8', LANGUAGE: 'zh_CN' }, en: { LANG: 'en_US.UTF-8', LANGUAGE: 'en' } };
const THEMES = ['light', 'sysdark', 'zhihudark'];
const WIDTHS = [320, 375, 1280];
const rows = []; const failures = [];

async function measure(page) {
  return page.evaluate(() => {
    const b = document.querySelector('#zhihu-md-floating-ball'); const t = b.querySelector('.tooltip');
    const r = t.getBoundingClientRect(); const vw = document.documentElement.clientWidth; const vh = document.documentElement.clientHeight;
    const nws = [...t.querySelectorAll('.nw')].map((n) => { const rs = [...n.getClientRects()]; return { lines: rs.length, top: Math.round(rs[0]?.top ?? 0), w: +(rs[0]?.width ?? 0).toFixed(1) }; });
    return {
      text: t.textContent, visible: getComputedStyle(t).opacity === '1',
      left: +r.left.toFixed(1), right: +(vw - r.right).toFixed(1), top: +r.top.toFixed(1), bottom: +(vh - r.bottom).toFixed(1),
      width: +r.width.toFixed(1), height: +r.height.toFixed(1), lines: Math.round((r.height - 14) / 18),
      nwOneLineEach: nws.every((n) => n.lines === 1), nwTops: nws.map((n) => n.top), nwWidths: nws.map((n) => n.w), placement: t.dataset.placement || '',
      ball: (() => { const q = b.getBoundingClientRect(); return { left: Math.round(q.left), top: Math.round(q.top) }; })(),
    };
  });
}

async function hover(page) {
  const bb = await page.locator('#zhihu-md-floating-ball').boundingBox();
  await page.mouse.move(5, 5); await page.waitForTimeout(150);
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(700);
}

async function drag(page, tx, ty) {
  const bb = await page.locator('#zhihu-md-floating-ball').boundingBox();
  const cx = bb.x + bb.width / 2; const cy = bb.y + bb.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + ((tx - cx) * i) / 10, cy + ((ty - cy) * i) / 10);
  await page.mouse.up(); await page.waitForTimeout(1100); // 吸边 800ms
}

// E2E_ONLY=msg 只跑 v9 成功提示那组（调试用；验收跑全量）
for (const [lang, env] of Object.entries(process.env.E2E_ONLY === 'msg' ? {} : LANGS)) {
  for (const theme of THEMES) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tooltip-'));
    const ctx = await chromium.launchPersistentContext(prof, {
      headless: false, executablePath: process.env.CHROME_PATH, locale: lang,
      env: { ...process.env, ...env }, colorScheme: theme === 'sysdark' ? 'dark' : 'light',
      viewport: { width: 1280, height: VH },
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, `--lang=${lang}`],
    });
    try {
      await ctx.route('https://www.zhihu.com/**', (r) => r.fulfill({ path: fixture, contentType: 'text/html' }));
      if (theme === 'zhihudark') await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { document.documentElement.setAttribute('data-theme', 'dark'); document.body.style.background = '#191b1f'; }));
      let sw = ctx.serviceWorkers()[0]; if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
      const page = await ctx.newPage();
      for (const vw of WIDTHS) {
        await page.setViewportSize({ width: vw, height: VH });
        await sw.evaluate(() => chrome.storage.local.remove('floatingBallPosition'));
        await page.goto('https://www.zhihu.com/question/100/answer/200');
        await page.locator('#zhihu-md-floating-ball').waitFor({ timeout: 15000 }); await page.waitForTimeout(1200);
        const steps = [
          ['default', null],
          ['leftmost', [0, VH / 2]],
          ['top', [vw - 46, 0]],
          ['bottom', [vw - 46, VH - 1]],
        ];
        for (const [pos, target] of steps) {
          if (target) await drag(page, ...target);
          await hover(page);
          const m = await measure(page);
          const row = { lang, theme, vw, pos, ...m }; rows.push(row);
          if (shots) await page.screenshot({ path: path.join(shots, `${lang}-${theme}-${vw}-${pos}.png`) });
          const bad = [];
          if (!m.visible) bad.push('提示未显示');
          for (const s of ['left', 'right', 'top', 'bottom']) if (m[s] < EDGE) bad.push(`${s}=${m[s]}`);
          if (vw === 1280 && pos === 'default' && m.lines !== 1) bad.push(`1280 默认位置 ${m.lines} 行`);
          if (!m.nwOneLineEach) bad.push('短语内部折行');
          if (m.lines === 2 && m.nwTops.length === 2 && m.nwTops[0] === m.nwTops[1]) bad.push('两行但两段在同一行');
          if (bad.length) failures.push(`${lang}/${theme}/${vw}/${pos}: ${bad.join(', ')}`);
        }
      }
    } finally {
      await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
    }
  }
}

// v9：成功提示带失败图片（en 320，浅色）
{
  const html = fs.readFileSync(fixture, 'utf8');
  const variant = (n) => { return (() => { const re = /<img src="data:[^"]*"[^>]*>/g; const first = html.match(re)[0]; let k = 0; return html.replace(re, () => (k++ === 0 ? Array.from({ length: n }, (_, j) => first.replace(/data-original="[^"]*"/, `data-original="https://pic1.zhimg.com/v2-e2efail${j}.jpg"`)).join('') : '')); })(); };
  const vw = 320;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tooltip-'));
  const ctx = await chromium.launchPersistentContext(prof, {
    headless: false, executablePath: process.env.CHROME_PATH, locale: 'en', acceptDownloads: true,
    env: { ...process.env, ...LANGS.en }, colorScheme: 'light', viewport: { width: vw, height: VH },
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--lang=en', '--host-resolver-rules=MAP *.zhimg.com ~NOTFOUND'],
  });
  try {
    await ctx.route('https://www.zhihu.com/**', (r) => { const n = Number(new URL(r.request().url()).searchParams.get('fail') || 0); r.fulfill({ body: variant(n), contentType: 'text/html; charset=utf-8' }); });
    let sw = ctx.serviceWorkers()[0]; if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    await sw.evaluate(() => chrome.storage.sync.set({ downloadImages: true }));
    const page = await ctx.newPage();
    for (const n of [1, 3]) {
      const want = n === 1 ? "Exported. 1 image couldn't be downloaded; online link kept" : `Exported. ${n} images couldn't be downloaded; online links kept`;
      for (const [pos, target] of [['default', null], ['leftmost', [0, VH / 2]], ['top', [vw - 46, 0]], ['bottom', [vw - 46, VH - 1]]]) {
        await sw.evaluate(() => chrome.storage.local.remove('floatingBallPosition'));
        await page.goto(`https://www.zhihu.com/question/282627359/answer/2571795386?fail=${n}`);
        await page.locator('#zhihu-md-floating-ball').waitFor({ timeout: 15000 }); await page.waitForTimeout(1200);
        if (target) await drag(page, ...target);
        await hover(page);
        const bb = await page.locator('#zhihu-md-floating-ball').boundingBox();
        await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
        const ok = await page.locator('#zhihu-md-floating-ball.success').waitFor({ timeout: 30000 }).then(() => true, () => false);
        await page.waitForTimeout(400);
        const m = await measure(page);
        const nwText = await page.evaluate(() => [...document.querySelectorAll('#zhihu-md-floating-ball .tooltip .nw')].map((x) => x.textContent));
        const row = { lang: 'en', theme: 'light', vw, pos: `msg${n}-${pos}`, ...m, nwText }; rows.push(row);
        if (shots) await page.screenshot({ path: path.join(shots, `en-light-${vw}-msg${n}-${pos}.png`) });
        const bad = [];
        if (!ok) bad.push('没有进入成功态');
        if (m.text !== want) bad.push(`文字=${m.text}`);
        if (!m.visible) bad.push('提示未显示');
        for (const s of ['left', 'right', 'top', 'bottom']) if (m[s] < EDGE) bad.push(`${s}=${m[s]}`);
        if (JSON.stringify(nwText) !== JSON.stringify(["couldn't be downloaded"])) bad.push(`nw=${JSON.stringify(nwText)}`);
        if (!m.nwOneLineEach) bad.push("couldn't be downloaded 被折开");
        if (bad.length) failures.push(`en/light/${vw}/msg${n}-${pos}: ${bad.join(', ')}`);
      }
    }
  } finally {
    await ctx.close(); fs.rmSync(prof, { recursive: true, force: true });
  }
}

const min = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((s) => [s, Math.min(...rows.map((r) => r[s]))]));
// 成功提示四边同样要 ≥8，单独列出它们的最小值
const out = { rows, min, failures };
if (process.env.E2E_OUT) fs.writeFileSync(process.env.E2E_OUT, JSON.stringify(out, null, 1));
console.log('lang\ttheme\tvw\tpos\tplace\tL\tR\tT\tB\tlines\th\tw');
for (const r of rows) console.log([r.lang, r.theme, r.vw, r.pos, r.placement, r.left, r.right, r.top, r.bottom, r.lines, r.height, r.width].join('\t'));
console.log(`最小距离：左 ${min.left} 右 ${min.right} 上 ${min.top} 下 ${min.bottom}（共 ${rows.length} 组）`);
if (failures.length) { console.error(`FAIL ${failures.length}:\n${failures.join('\n')}`); process.exit(1); }
console.log('e2e tooltip edges PASS');
