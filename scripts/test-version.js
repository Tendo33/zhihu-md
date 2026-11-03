// 发版 QA ZR-01：版本号在 package.json / package-lock / manifest.src.json / CHANGELOG 一致
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const v = JSON.parse(read('package.json')).version;
const lock = JSON.parse(read('package-lock.json'));
assert.equal(v, '1.2.0');
assert.equal(lock.version, v);
assert.equal(lock.packages[''].version, v);
assert.equal(JSON.parse(read('manifest.src.json')).version, v);
assert.match(read('CHANGELOG.md'), new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
// README 只写默认快捷键，实际生效的以弹窗底栏为准（升级用户可能保留旧快捷键）
assert.match(read('README.md'), /默认 `Alt\+Shift\+K`[^\n]*以弹窗底栏显示的为准/);
assert.match(read('README.en.md'), /Defaults to `Alt\+Shift\+K`[^\n]*the popup footer shows the one in effect/);
{
  const cl = read('CHANGELOG.md');
  const section = (ver) => cl.slice(cl.indexOf(`## [${ver}]`), cl.indexOf('\n## [', cl.indexOf(`## [${ver}]`) + 1) >>> 0);
  assert.match(section('1.1.10'), /https:\/\/\*\.zhimg\.com\/\*/, 'CHANGELOG 1.1.10 写明新增图床主机权限');
  assert.match(section('1.1.8'), /商店名称和简介支持中英文/, 'CHANGELOG 1.1.8 写明商店多语言');
  // 以下是 1.1.7 引入的改动，留在 1.1.7 段
  const sec = section('1.1.7');
  assert.match(sec, /Chrome 121/, 'CHANGELOG 1.1.7 写明最低 Chrome 121');
  assert.match(sec, /SVG、ico、无法识别格式和非知乎图床（zhimg.com）的图片不打包，保留在线链接，单独提示「N 张图片保留为在线链接」，不算下载失败/, 'CHANGELOG 写明保留在线链接单独计数');
}
console.log('version consistency tests passed');
