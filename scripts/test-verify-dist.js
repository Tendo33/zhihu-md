import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
console.log('verify-dist tests passed');
