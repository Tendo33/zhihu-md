// P2Z-B（设计决定）：图片没下载下来是提示不是报错，界面文案统一说「N 张图片未能下载，已保留在线链接」。
// 防回归：扩展源码里「图片下载失败」只允许出现在 background 的开发者日志（Logger.error / Logger.warn，真的出错）里。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageFailText, imagePartialLine, imagePartialSrExtra } from '../lib/image-pack.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIRS = ['lib', 'content', 'popup', 'options', 'background'];
const hits = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs|html|css|json)$/.test(e.name)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('图片下载失败')) hits.push({ file: path.relative(root, p), line: i + 1, text: line.trim() });
      });
    }
  }
}
SRC_DIRS.forEach((d) => walk(path.join(root, d)));
walk(path.join(root, '_locales'));
const bad = hits.filter((h) => !(h.file.startsWith('background' + path.sep) && /Logger\.(error|warn)\(/.test(h.text)));
assert.deepEqual(bad, [], `非错误文案里出现「图片下载失败」：${JSON.stringify(bad, null, 1)}`);

// 文案函数本身
for (const s of [imageFailText(3), imagePartialLine(3, 0), imagePartialLine(3, 2), imagePartialSrExtra(3, 0), imagePartialSrExtra(3, 2), imagePartialSrExtra(0, 5)]) {
  assert.doesNotMatch(s, /失败/, s);
}
assert.equal(imageFailText(3), '3 张图片未能下载，已保留在线链接');
console.log(`copy no-fail tests passed（允许的日志位置 ${hits.length - bad.length} 处）`);
