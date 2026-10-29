// 验收基线 R16：扩展页面样式里的 padding / margin / gap 只用 2 的倍数（>1px），不出现 5px、15px 这类奇数值（设计复核 M3）
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['lib/ui-v2.css', 'popup/popup.css', 'options/options.css'];
const bad = [];
for (const f of files) {
  const css = fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(?:^|[;{\s])((?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?)\s*:\s*([^;}]+)/g)) {
    for (const n of m[2].matchAll(/(-?\d*\.?\d+)px/g)) {
      const v = Math.abs(parseFloat(n[1]));
      if (v > 1 && v % 2 !== 0) bad.push(`${f}: ${m[1]}: ${m[2].trim()}`);
    }
  }
}
assert.deepEqual(bad, [], 'R16 间距出现非 2 倍数：\n' + bad.join('\n'));
const ui = fs.readFileSync(path.join(root, 'lib/ui-v2.css'), 'utf8');
assert.match(ui, /kbd\{[^}]*padding:2px 6px/, 'popup 快捷键 kbd 左右内边距为 6px（与 .badge 的 2px 6px 一致）');
console.log('spacing token tests passed');
