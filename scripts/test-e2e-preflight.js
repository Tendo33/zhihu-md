// batch5：e2e 脚本的环境前置检查——缺 playwright / CHROME_PATH 时给出提示并以 2 退出（不启动浏览器）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e-shortcut.js');
const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fakepw-'));
fs.mkdirSync(path.join(fake, 'node_modules/playwright'), { recursive: true });
fs.writeFileSync(path.join(fake, 'package.json'), '{}');
// batch7：E2E_FAKE_LAUNCH_ERR 设置时 launchPersistentContext 抛这个错，用来模拟启动失败
fs.writeFileSync(path.join(fake, 'node_modules/playwright/index.js'),
  'module.exports={chromium:{launchPersistentContext:async()=>{throw new Error(process.env.E2E_FAKE_LAUNCH_ERR||"x")}}};');
fs.mkdirSync(path.join(fake, 'dist'));
fs.writeFileSync(path.join(fake, 'dist/manifest.json'), JSON.stringify({ commands: { 'export-page': { suggested_key: { default: 'Alt+Shift+K' } } } }));
const run = (env) => {
  const e = { ...process.env, ...env };
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];
  return spawnSync(process.execPath, [script], { env: e, encoding: 'utf8' });
};
let r;
// 本仓库 node_modules 里恰好装了 playwright 时跳过这一条
if (!fs.existsSync(path.join(path.dirname(script), '..', 'node_modules/playwright'))) {
  r = run({ E2E_PLAYWRIGHT_DIR: undefined, CHROME_PATH: undefined });
  assert.equal(r.status, 2); assert.match(r.stderr, /找不到 playwright/); // 不再回落到写死的本机目录
}
r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: undefined });
assert.equal(r.status, 2); assert.match(r.stderr, /未设置 CHROME_PATH/);
r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: path.join(fake, 'no-such-chrome') });
assert.equal(r.status, 2); assert.match(r.stderr, /CHROME_PATH 指向的文件不存在/);
// batch6 ZB5-01：没有 dist/ 时提示先构建，退出 2，不带堆栈
const fakeChrome = path.join(fake, 'chrome');
fs.writeFileSync(fakeChrome, '');
fs.chmodSync(fakeChrome, 0o755); // batch7：现在会检查执行权限
r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fakeChrome, DISPLAY: 'localhost:99', E2E_DIST: path.join(fake, 'no-dist') });
assert.equal(r.status, 2); assert.match(r.stderr, /请先构建（npm run build）/); assert.doesNotMatch(r.stderr, /ENOENT|\n\s+at /);
// batch6 ZB5-02：CHROME_PATH 指向目录 / 没有 DISPLAY 时提示并退出 2，不带堆栈
r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fake, DISPLAY: 'localhost:99' });
assert.equal(r.status, 2); assert.match(r.stderr, /CHROME_PATH 指向的是目录/); assert.doesNotMatch(r.stderr, /\n\s+at /);
if (process.platform === 'linux') {
  r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fakeChrome, DISPLAY: undefined, WAYLAND_DISPLAY: undefined });
  assert.equal(r.status, 2); assert.match(r.stderr, /没有可用的显示器（DISPLAY 未设置）/); assert.match(r.stderr, /xvfb-run/); assert.doesNotMatch(r.stderr, /\n\s+at /);
}
// batch7 ZB6-02：CHROME_PATH 是没有执行权限的文件
r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: path.join(fake, 'package.json'), DISPLAY: 'localhost:99' });
assert.equal(r.status, 2); assert.match(r.stderr, /CHROME_PATH 不是可执行文件/); assert.doesNotMatch(r.stderr, /EACCES|\n\s+at /);
// batch7 ZB6-01：DISPLAY=:777 没有 X server
if (process.platform === 'linux' && !fs.existsSync('/tmp/.X11-unix/X777')) {
  r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fakeChrome, DISPLAY: ':777', WAYLAND_DISPLAY: undefined });
  assert.equal(r.status, 2); assert.match(r.stderr, /DISPLAY=:777 连接不上/); assert.match(r.stderr, /xvfb-run/); assert.doesNotMatch(r.stderr, /\n\s+at /);
}
// batch7 ZB6-01/02/04：启动失败 → 中文提示、exit 2、临时 profile 被删
for (const [err, hint] of [
  ['browserType.launchPersistentContext: Target page, context or browser has been closed\nLooks like you launched a headed browser without having a XServer running.', /没有可用的 X server/],
  ['browserType.launchPersistentContext: Failed to launch: Error: spawn /x/chrome EACCES', /CHROME_PATH 不是可执行的 Chrome/],
  ['boom', /Chrome 启动失败：boom/],
]) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-tmp-'));
  r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fakeChrome, DISPLAY: 'localhost:99', E2E_DIST: path.join(fake, 'dist'), E2E_FAKE_LAUNCH_ERR: err, TMPDIR: tmp });
  const left = fs.readdirSync(tmp).filter((f) => f.startsWith('e2e-shortcut-'));
  fs.rmSync(tmp, { recursive: true, force: true });
  assert.equal(r.status, 2, r.stderr); assert.match(r.stderr, hint); assert.doesNotMatch(r.stderr, /\n\s+at /);
  assert.deepEqual(left, []);
}
fs.rmSync(fake, { recursive: true, force: true });
console.log('e2e preflight: missing playwright / CHROME_PATH / dir / non-exec / DISPLAY / :777 / dist / launch failure cleanup → exit 2 passed');
