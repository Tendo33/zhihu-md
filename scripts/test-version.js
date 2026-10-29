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
console.log('version consistency tests passed');
