// 发版 QA ZR-01：版本号在 package.json / package-lock / manifest.src.json / CHANGELOG 一致
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const v = JSON.parse(read('package.json')).version;
const lock = JSON.parse(read('package-lock.json'));
assert.equal(v, '1.1.8');
assert.equal(lock.version, v);
assert.equal(lock.packages[''].version, v);
assert.equal(JSON.parse(read('manifest.src.json')).version, v);
assert.match(read('CHANGELOG.md'), new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
// 快捷键默认值是 1.1.7 引入的，README 写的是功能起始版本，不随当前版本变
assert.match(read('README.md'), /1\.1\.7 起新安装默认/);
assert.match(read('README.en.md'), /From 1\.1\.7, fresh installs/);
{
  const cl = read('CHANGELOG.md');
  const section = (ver) => cl.slice(cl.indexOf(`## [${ver}]`), cl.indexOf('\n## [', cl.indexOf(`## [${ver}]`) + 1) >>> 0);
  assert.match(section(v), /商店名称和简介支持中英文/, 'CHANGELOG 1.1.8 写明商店多语言');
  // 以下是 1.1.7 引入的改动，留在 1.1.7 段
  const sec = section('1.1.7');
  assert.match(sec, /Chrome 121/, 'CHANGELOG 1.1.7 写明最低 Chrome 121');
  assert.match(sec, /SVG、ico、无法识别格式和非知乎图床（zhimg.com）的图片不打包，保留在线链接，单独提示「N 张图片保留为在线链接」，不算下载失败/, 'CHANGELOG 写明保留在线链接单独计数');
}
console.log('version consistency tests passed');
