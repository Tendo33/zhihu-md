// 发版 QA ZR-01：版本号在 package.json / package-lock / manifest.src.json / CHANGELOG 一致
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const v = JSON.parse(read('package.json')).version;
const lock = JSON.parse(read('package-lock.json'));
assert.equal(v, '1.1.7');
assert.equal(lock.version, v);
assert.equal(lock.packages[''].version, v);
assert.equal(JSON.parse(read('manifest.src.json')).version, v);
assert.match(read('CHANGELOG.md'), new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
assert.match(read('README.md'), new RegExp(`${v.replace(/\./g, '\\.')} 起新安装默认`));
assert.match(read('README.en.md'), new RegExp(`From ${v.replace(/\./g, '\\.')}, fresh installs`));
{
  const cl = read('CHANGELOG.md');
  const sec = cl.slice(cl.indexOf(`## [${v}]`), cl.indexOf('\n## [', cl.indexOf(`## [${v}]`) + 1) >>> 0);
  assert.match(sec, /Chrome 121/, 'CHANGELOG 当前版本写明最低 Chrome 121');
  assert.match(sec, /SVG、ico、无法识别格式和非知乎图床（zhimg.com）的图片不打包，保留在线链接，单独提示「N 张图片保留为在线链接」，不算下载失败/, 'CHANGELOG 写明保留在线链接单独计数');
}
console.log('version consistency tests passed');
