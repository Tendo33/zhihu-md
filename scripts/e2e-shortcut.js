// Z3-03 回归 e2e：干净 profile 加载 dist，断言 commands.getAll() 里 export-page 的快捷键非空且等于 manifest 建议键。
// 本地脚本（npm run test:e2e）：需要 Playwright + Chromium，且扩展需要有界面的浏览器（Linux 无显示器时用 xvfb-run）。
// 仓库不新增 playwright 依赖：优先用本仓库 node_modules，否则用 E2E_PLAYWRIGHT_DIR（默认团队 tools/node_modules）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const COMMAND = 'export-page';

function loadPlaywright() {
  const dirs = [root, process.env.E2E_PLAYWRIGHT_DIR || '/workspace/chrome-ext-team/tools'];
  for (const d of dirs) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e: 找不到 playwright。设置 E2E_PLAYWRIGHT_DIR 指向含 node_modules/playwright 的目录。');
  process.exit(2);
}

const { chromium } = loadPlaywright();
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const expected = manifest.commands[COMMAND].suggested_key.default;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-shortcut-'));
const ctx = await chromium.launchPersistentContext(prof, {
  headless: false,
  executablePath: process.env.CHROME_PATH || undefined,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let code = 1;
try {
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const cmds = await sw.evaluate(() => chrome.commands.getAll());
  const c = cmds.find((x) => x.name === COMMAND);
  const ver = ctx.browser()?.version?.() ?? '';
  console.log(`e2e: ${ver} ${COMMAND} shortcut=${JSON.stringify(c && c.shortcut)} expected=${expected}`);
  if (!c) throw new Error(`命令 ${COMMAND} 不存在`);
  if (!c.shortcut) throw new Error('快捷键为空：Chrome 没有注册建议键（可能被浏览器保留）');
  if (c.shortcut.replace(/\s/g, '') !== expected) throw new Error(`快捷键 ${c.shortcut} ≠ ${expected}`);
  console.log('e2e shortcut: PASS');
  code = 0;
} catch (e) {
  console.error('e2e shortcut: FAIL —', e.message);
} finally {
  await ctx.close();
  fs.rmSync(prof, { recursive: true, force: true });
}
process.exit(code);
