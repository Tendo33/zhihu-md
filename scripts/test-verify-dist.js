import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyDist, htmlRefs, verifyBackground } from './verify-dist.js';

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
assert.deepEqual(r.extraIcons, []);
// 复审建议 1：未被 manifest 引用的图标（如 icons/icon.png）出现在 dist 里要报出来
write('icons/icon.png');
assert.deepEqual(verifyDist(dir).extraIcons, ['icons/icon.png']);
fs.rmSync(path.join(dir, 'icons/icon.png'));
assert.deepEqual(htmlRefs('<img src="a.png?x=1"><a href="b.html"><script src="//x/y.js">'), ['a.png']);
// 商店多语言：有 default_locale 时 messages.json 进文件清单，locale 问题单独报
{
  const mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...mf, name: '__MSG_extName__', default_locale: 'zh_CN' }));
  let v = verifyDist(dir);
  assert.ok(v.missing.includes('default_locale: _locales/zh_CN/messages.json'));
  assert.ok(v.localeErrors.length > 0);
  write('_locales/zh_CN/messages.json', JSON.stringify({ extName: { message: 'A' }, extDescription: { message: 'B' } }));
  write('_locales/en/messages.json', JSON.stringify({ extName: { message: 'A' }, extDescription: { message: 'B' } }));
  v = verifyDist(dir);
  assert.deepEqual(v.missing, []);
  assert.deepEqual(v.localeErrors, []);
  assert.ok(v.checked.includes('_locales/zh_CN/messages.json'));
  // 审查 P3：名称 ≤75、short_name ≤12；正好等于上限通过，超 1 个字符报错；没有 short_name 不检查
  const msgs = (name, extra = {}) => JSON.stringify({ extName: { message: name }, extDescription: { message: 'B' }, ...extra });
  write('_locales/en/messages.json', msgs('N'.repeat(75)));
  write('_locales/zh_CN/messages.json', msgs('知'.repeat(75)));
  assert.deepEqual(verifyDist(dir).localeErrors, [], '名称 75 字符通过');
  write('_locales/en/messages.json', msgs('N'.repeat(76)));
  assert.deepEqual(verifyDist(dir).localeErrors, ['_locales/en: name（extName）超过 75 字符（76）']);
  write('_locales/en/messages.json', msgs('A'));
  write('_locales/zh_CN/messages.json', msgs('知'.repeat(76)));
  assert.deepEqual(verifyDist(dir).localeErrors, ['_locales/zh_CN: name（extName）超过 75 字符（76）'], '按字符数算，不按字节');
  write('_locales/zh_CN/messages.json', msgs('A', { extShortName: { message: '知'.repeat(13) } }));
  assert.deepEqual(verifyDist(dir).localeErrors, ['_locales/zh_CN: short_name（extShortName）超过 12 字符（13）'], 'messages 里有 short_name 条目时检查');
  write('_locales/zh_CN/messages.json', msgs('A', { extShortName: { message: '知'.repeat(12) } }));
  assert.deepEqual(verifyDist(dir).localeErrors, []);
  const mf2 = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...mf2, short_name: '__MSG_extShortName__' }));
  write('_locales/en/messages.json', msgs('A', { extShortName: { message: 'Zhihu2Markdown' } }));
  write('_locales/zh_CN/messages.json', msgs('A', { extShortName: { message: '知乎转MD' } }));
  assert.deepEqual(verifyDist(dir).localeErrors, ['_locales/en: short_name（extShortName）超过 12 字符（14）'], 'manifest short_name 用 __MSG_');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...mf2, short_name: 'Zhihu2Markdown' }));
  write('_locales/en/messages.json', msgs('A'));
  write('_locales/zh_CN/messages.json', msgs('A'));
  assert.deepEqual(verifyDist(dir).localeErrors, ['manifest short_name 超过 12 字符（14）'], 'manifest 字面 short_name');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...mf2, name: 'N'.repeat(76), default_locale: undefined }));
  assert.deepEqual(verifyDist(dir).localeErrors, ['manifest name 超过 75 字符（76）'], 'manifest 字面 name');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(mf2));
}
fs.rmSync(dir, { recursive: true, force: true });

// background：Chrome 产物不能有 scripts，Firefox 产物必须有
assert.deepEqual(verifyBackground({ background: { service_worker: 'bg.js' } }), []);
assert.deepEqual(verifyBackground({ background: { service_worker: 'bg.js', scripts: ['bg.js'] } }), ['Chrome/Edge 产物不能有 background.scripts（MV3 下 Chrome 会报错）']);
assert.deepEqual(verifyBackground({ background: { service_worker: 'bg.js', scripts: [] } }, 'chrome').length, 1, '空数组也算有 scripts');
assert.deepEqual(verifyBackground({ background: {} }, 'chrome'), ['Chrome/Edge 产物缺少 background.service_worker']);
assert.deepEqual(verifyBackground({ background: { service_worker: 'bg.js', scripts: ['bg.js'] } }, 'firefox'), []);
assert.deepEqual(verifyBackground({ background: { service_worker: 'bg.js' } }, 'firefox'), ['Firefox 产物缺少 background.scripts（Firefox 不支持 service_worker）']);

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
// CLI：Chrome 产物带 scripts 时以 1 退出；--target=firefox 时反过来
put('manifest.json', JSON.stringify({ manifest_version: 3, action: { default_popup: 'popup/popup.html' }, background: { service_worker: 'bg.js', scripts: ['bg.js'] } }));
cli = run();
assert.equal(cli.status, 1, cli.stdout);
assert.match(cli.stderr, /不能有 background\.scripts/);
cli = spawnSync(process.execPath, ['scripts/verify-dist.js', 'dist', '--target=firefox'], { cwd: repo, encoding: 'utf8' });
assert.equal(cli.status, 0, cli.stderr);
assert.match(cli.stdout, /target: firefox/);
fs.rmSync(path.join(repo, 'dist', 'manifest.json'));
cli = run();
assert.equal(cli.status, 1);
assert.match(cli.stderr, /找不到/);
fs.rmSync(root, { recursive: true, force: true });
console.log('verify-dist tests passed');
