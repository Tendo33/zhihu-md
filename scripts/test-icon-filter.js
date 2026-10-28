// 复审建议 1：构建只拷贝 manifest 引用的图标。直接跑 build，检查 dist/icons 与 manifest 引用集合完全一致、icon.png 不在 dist。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyDist } from './verify-dist.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync(process.execPath, [path.join(root, 'scripts/build.js')], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
const dist = path.join(root, 'dist');
const src = JSON.parse(fs.readFileSync(path.join(root, 'manifest.src.json'), 'utf8'));
const used = new Set([...Object.values(src.icons || {}), ...Object.values(src.action?.default_icon || {})]);
const got = fs.readdirSync(path.join(dist, 'icons')).map((n) => `icons/${n}`).sort();
assert.deepEqual(got, [...used].sort(), 'dist/icons 应只包含 manifest 引用的图标');
assert.ok(fs.existsSync(path.join(root, 'icons/icon.png')), '源码里仍有未引用的 icon.png（本测试的前提）');
assert.ok(!fs.existsSync(path.join(dist, 'icons/icon.png')), 'icon.png 不应进入 dist');
assert.deepEqual(verifyDist(dist).extraIcons, []);
console.log('icon filter tests passed');
