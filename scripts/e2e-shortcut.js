// Z3-03 回归 e2e：干净 profile 加载 dist，断言 commands.getAll() 里 export-page 的快捷键非空且等于 manifest 建议键。
// 本地脚本（npm run test:e2e）：需要 Playwright + Chromium，且扩展需要有界面的浏览器（Linux 无显示器时用 xvfb-run）。
// 仓库不新增 playwright 依赖：优先用本仓库 node_modules，否则用 E2E_PLAYWRIGHT_DIR；CHROME_PATH 必填。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// batch6 ZB5-01：E2E_DIST 只给测试用，默认仍是仓库 dist/
const dist = process.env.E2E_DIST || path.join(root, 'dist');
const COMMAND = 'export-page';

function loadPlaywright() {
  // batch5：不再写死本机默认目录；只认本仓库 node_modules 或显式设置的 E2E_PLAYWRIGHT_DIR
  const dirs = [root, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean);
  for (const d of dirs) {
    try { return createRequire(path.join(d, 'package.json'))('playwright'); } catch { /* next */ }
  }
  console.error('e2e: 找不到 playwright。本仓库不依赖 playwright，请设置 E2E_PLAYWRIGHT_DIR 指向含 node_modules/playwright 的目录，例如：\n  E2E_PLAYWRIGHT_DIR=/path/to/tools CHROME_PATH=/path/to/chrome xvfb-run -a npm run test:e2e');
  process.exit(2);
}

// batch5：CHROME_PATH 未设置或文件不存在时给出提示并以非 0 退出，不再让 Playwright 抛一长串堆栈
function chromePath() {
  const p = process.env.CHROME_PATH;
  if (!p) {
    console.error('e2e: 未设置 CHROME_PATH。请指向 Chromium/Chrome 可执行文件（例如 Playwright 下载的 chrome-linux64/chrome）。');
    process.exit(2);
  }
  if (!fs.existsSync(p)) {
    console.error(`e2e: CHROME_PATH 指向的文件不存在：${p}`);
    process.exit(2);
  }
  // batch6 ZB5-02：指向目录时 Playwright 只会抛 EACCES/spawn 堆栈，这里直接提示
  if (fs.statSync(p).isDirectory()) {
    console.error(`e2e: CHROME_PATH 指向的是目录，不是可执行文件：${p}\n  请指向目录里的 chrome 可执行文件（例如 .../chrome-linux64/chrome）。`);
    process.exit(2);
  }
  // batch7 ZB6-02：文件存在但没有执行权限时，Playwright 只会抛 spawn EACCES 堆栈
  try {
    fs.accessSync(p, fs.constants.X_OK);
  } catch {
    console.error(`e2e: CHROME_PATH 不是可执行文件（没有执行权限）：${p}\n  请指向 Chromium/Chrome 可执行文件（例如 .../chrome-linux64/chrome）。`);
    process.exit(2);
  }
  return p;
}

// batch6 ZB5-02：Linux 上没有显示器时，有界面的 Chrome 起不来；提示用 xvfb-run，而不是抛 Playwright 堆栈
function requireDisplay() {
  if (process.platform !== 'linux') return;
  if (process.env.WAYLAND_DISPLAY) return;
  const display = process.env.DISPLAY;
  if (display) {
    // batch7 ZB6-01：本机显示 :N 要有 /tmp/.X11-unix/XN；没有就说明 X server 不在（远程 host:N 不检查，交给启动处兜底）
    // 只检查本地 socket：host:N / localhost:N 这类 TCP 形式的 DISPLAY 不做任何连通性检查（不探测 6000+N 端口），
    // 连不上时由后面 chromium.launch 失败的 catch 给出提示；测试里用 localhost:99 跳过本检查正是依赖这一点。
    const m = /^:(\d+)(?:\.\d+)?$/.exec(display);
    if (!m || fs.existsSync(`/tmp/.X11-unix/X${m[1]}`)) return;
    console.error(`e2e: DISPLAY=${display} 连接不上（找不到 /tmp/.X11-unix/X${m[1]}）。请用 xvfb-run 运行，例如：\n  xvfb-run -a npm run test:e2e`);
    process.exit(2);
  }
  console.error('e2e: 没有可用的显示器（DISPLAY 未设置）。扩展需要有界面的 Chrome，请用 xvfb-run 运行，例如：\n  xvfb-run -a npm run test:e2e');
  process.exit(2);
}

// batch7 ZB6-01/02：把 Chrome 启动失败归成几类中文提示
function launchFailureHint(e, executablePath) {
  const msg = String((e && e.message) || e);
  if (/X ?server|Missing X|cannot open display/i.test(msg)) {
    return `e2e: Chrome 起不来：DISPLAY=${process.env.DISPLAY || ''} 上没有可用的 X server。请用 xvfb-run 运行，例如：\n  xvfb-run -a npm run test:e2e`;
  }
  if (/\b(?:EACCES|ENOEXEC|ENOENT)\b/.test(msg)) {
    return `e2e: Chrome 起不来：CHROME_PATH 不是可执行的 Chrome：${executablePath}`;
  }
  return `e2e: Chrome 启动失败：${msg.split('\n')[0]}`;
}

// batch6 ZB5-01：没有 dist/ 时给出中文提示并以 2 退出，不再抛 ENOENT 堆栈
function requireDist() {
  if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
    console.error(`e2e: 找不到 ${path.join(dist, 'manifest.json')}，请先构建（npm run build），或直接用 npm run test:e2e（会先构建）。`);
    process.exit(2);
  }
}

const { chromium } = loadPlaywright();
const executablePath = chromePath(); // 先于读取 dist，环境问题最先报
requireDisplay();
requireDist();
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const expected = manifest.commands[COMMAND].suggested_key.default;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-shortcut-'));
let ctx;
try {
  ctx = await chromium.launchPersistentContext(prof, {
    headless: false,
    executablePath,
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
} catch (e) {
  // batch7 ZB6-01/02/04：启动失败也删临时 profile，并给中文提示、exit 2，不打 Playwright 堆栈
  fs.rmSync(prof, { recursive: true, force: true });
  console.error(launchFailureHint(e, executablePath));
  process.exit(2);
}
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
