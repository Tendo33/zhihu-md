// 审查 bg-scripts P2：--target 写错时 build / verify-dist 都报错退出，空格形式也能用
import assert from 'assert';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseTargetArgs } from './parse-target.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.deepEqual(parseTargetArgs([]), { target: 'chrome', rest: [] });
assert.deepEqual(parseTargetArgs(['--target=firefox']), { target: 'firefox', rest: [] });
assert.deepEqual(parseTargetArgs(['--target', 'firefox']), { target: 'firefox', rest: [] });
assert.deepEqual(parseTargetArgs(['dist-firefox', '--target', 'Firefox']), { target: 'firefox', rest: ['dist-firefox'] });
assert.deepEqual(parseTargetArgs(['--target', 'firefox', 'dist-firefox']), { target: 'firefox', rest: ['dist-firefox'] }, '空格形式的取值不当成目录');
for (const [bad, msg] of [
  [['--target='], /--target 的值为空/],
  [['--target=  '], /--target 的值为空/],
  [['--target'], /--target 后面缺少取值/],
  [['--target', '--x'], /--target 后面缺少取值/],
  [['--target=edge'], /未知的 --target 值「edge」/],
  [['--target', 'safari'], /未知的 --target 值「safari」/],
  [['--target=chrome', '--target=firefox'], /--target 写了 2 次/],
]) {
  const { error } = parseTargetArgs(bad);
  assert.ok(error, `应报错：${bad.join(' ')}`);
  assert.match(error, msg, `报错文字：${bad.join(' ')}`); // 审查 P3：空值检查删掉时会落到「未知值」，文字不同
}

const run = (script, args) => spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
for (const bad of [['--target='], ['--target'], ['--target=edge']]) {
  const r = run('build.js', bad);
  assert.equal(r.status, 1, `build ${bad.join(' ')} 应退出 1`);
  assert.match(r.stderr, /build 失败：/);
  assert.ok(!/target: chrome/.test(r.stdout), '不再静默按 Chrome 构建');
  const v = run('verify-dist.js', ['dist', ...bad]);
  assert.equal(v.status, 1, `verify-dist ${bad.join(' ')} 应退出 1`);
  assert.match(v.stderr, /verify:dist 失败：--target|verify:dist 失败：未知的 --target 值/);
}
// 空格形式真的产出 Firefox 包，verify 也认空格形式
try {
  const b = run('build.js', ['--target', 'firefox']);
  assert.equal(b.status, 0, b.stderr);
  const mf = JSON.parse(fs.readFileSync(path.join(root, 'dist-firefox', 'manifest.json'), 'utf8'));
  assert.ok(Array.isArray(mf.background?.scripts), 'Firefox 包保留 background.scripts');
  const v = run('verify-dist.js', ['dist-firefox', '--target', 'firefox']);
  assert.equal(v.status, 0, v.stderr);
} finally {
  fs.rmSync(path.join(root, 'dist-firefox'), { recursive: true, force: true });
}
console.log('target args tests passed');
