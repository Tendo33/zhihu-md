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
fs.writeFileSync(path.join(fake, 'node_modules/playwright/index.js'), 'module.exports={chromium:{}};');
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
r = run({ E2E_PLAYWRIGHT_DIR: fake, CHROME_PATH: fakeChrome, DISPLAY: ':99', E2E_DIST: path.join(fake, 'no-dist') });
assert.equal(r.status, 2); assert.match(r.stderr, /请先构建（npm run build）/); assert.doesNotMatch(r.stderr, /ENOENT|\n\s+at /);
fs.rmSync(fake, { recursive: true, force: true });
console.log('e2e preflight: missing playwright / CHROME_PATH / dist → exit 2 passed');
