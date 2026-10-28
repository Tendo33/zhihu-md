import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyDist, htmlRefs } from './verify-dist.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhihu-md-dist-'));
const write = (f, c = '') => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); };
write('manifest.json', JSON.stringify({
  manifest_version: 3,
  icons: { 16: 'icons/16.png' },
  action: { default_popup: 'popup/popup.html', default_icon: { 16: 'icons/16.png' } },
  background: { service_worker: 'background/bg.js' },
  content_scripts: [{ js: ['content/c.js'], css: ['content/c.css'] }],
}));
write('icons/16.png');
write('popup/popup.html', '<link rel="stylesheet" href="popup.css"><script src="popup.js"></script><script src="https://cdn.example.com/x.js"></script>');
write('popup/popup.css');
write('background/bg.js');
write('content/c.js');

let r = verifyDist(dir);
assert.deepEqual(r.missing.sort(), ['content_scripts[0].css[0]: content/c.css', 'popup/popup.html 引用: popup.js'].sort());
write('content/c.css');
write('popup/popup.js');
r = verifyDist(dir);
assert.deepEqual(r.missing, []);
assert.deepEqual(htmlRefs('<img src="a.png?x=1"><a href="b.html"><script src="//x/y.js">'), ['a.png']);
fs.rmSync(dir, { recursive: true, force: true });

// 作为 CLI 直接运行：仓库路径含空格和中文时也必须真的执行检查，缺文件时非零退出
const script = fileURLToPath(new URL('./verify-dist.js', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhihu md 测试 '));
const repo = path.join(root, '知乎 导出', 'zhihu-md');
fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
fs.copyFileSync(script, path.join(repo, 'scripts', 'verify-dist.js'));
const put = (f, c = '') => { const p = path.join(repo, 'dist', f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
put('manifest.json', JSON.stringify({ manifest_version: 3, action: { default_popup: 'popup/popup.html' }, background: { service_worker: 'bg.js' } }));
put('popup/popup.html', '<script src="popup.js"></script>');
put('bg.js');
const run = () => spawnSync(process.execPath, ['scripts/verify-dist.js'], { cwd: repo, encoding: 'utf8' });

let cli = run();
assert.equal(cli.status, 1, `缺 popup.js 时应以 1 退出，实际 ${cli.status}：${cli.stdout}${cli.stderr}`);
assert.match(cli.stderr, /verify:dist 失败：1 个文件缺失/);
assert.match(cli.stderr, /popup\/popup\.html 引用: popup\.js/);
put('popup/popup.js');
cli = run();
assert.equal(cli.status, 0, cli.stderr);
assert.match(cli.stdout, /verify:dist 通过/, '通过时必须有输出，证明检查真的执行了');
fs.rmSync(path.join(repo, 'dist', 'manifest.json'));
cli = run();
assert.equal(cli.status, 1);
assert.match(cli.stderr, /找不到/);
fs.rmSync(root, { recursive: true, force: true });
console.log('verify-dist tests passed');
