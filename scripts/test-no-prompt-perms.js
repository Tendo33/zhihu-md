// 1.1.10（Simon 决定）：使用时零确认、零运行时授权，所有权限安装/更新时一次授予
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const m = JSON.parse(fs.readFileSync(new URL('manifest.src.json', root), 'utf8'));

for (const key of Object.keys(m)) assert.ok(!key.startsWith('optional_'), `manifest 不得声明 ${key}`);
assert.deepEqual(m.host_permissions, ['*://*.zhihu.com/*', 'https://*.zhimg.com/*'], '只有知乎和知乎图床');
for (const p of [...m.permissions, ...m.host_permissions]) assert.ok(!/<all_urls>|^\*:\/\/\*\/|^https?:\/\/\*\//.test(p), `不得声明全站权限：${p}`);

// 源码里不得出现运行时授权或确认弹窗
const banned = [
  [/\bpermissions\s*\.\s*(request|contains|remove)\b/, 'permissions.request/contains/remove'],
  [/\bonAdded\b|\bonRemoved\b/, 'permissions 事件监听'],
  [/(^|[^.\w])confirm\s*\(|window\s*\.\s*confirm\s*\(/, 'confirm() 确认弹窗'],
  [/optional_(host_)?permissions/, 'optional_* 权限'],
];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return walk(p);
  return /\.(js|mjs|html)$/.test(d.name) && !d.name.endsWith('.min.js') ? [p] : [];
});
const rootPath = new URL('.', root).pathname;
const files = ['background', 'content', 'lib', 'options', 'popup'].flatMap((d) => walk(path.join(rootPath, d)));
assert.ok(files.length > 10, '应扫描到扩展源码');
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const [re, what] of banned) assert.ok(!re.test(src), `${path.relative(rootPath, f)} 不得使用 ${what}`);
}

// Firefox：只声明本地处理、不收集数据
assert.deepEqual(m.browser_specific_settings?.gecko?.data_collection_permissions, { required: ['none'] });

// 文档同步：隐私政策和 README 列出图床主机权限、写明安装时一次授予
const privacy = fs.readFileSync(new URL('PRIVACY.md', root), 'utf8');
assert.match(privacy, /`https:\/\/\*\.zhimg\.com\/\*`/);
assert.match(privacy, /granted once when you install or update/);
assert.doesNotMatch(privacy, /not part of the declared host access/);
const readme = fs.readFileSync(new URL('README.md', root), 'utf8');
assert.match(readme, /\| `https:\/\/\*\.zhimg\.com` \|/);
assert.doesNotMatch(readme, /无需权限/);
assert.match(fs.readFileSync(new URL('README.en.md', root), 'utf8'), /\| `https:\/\/\*\.zhimg\.com` \|/);
console.log('no-prompt permissions tests passed');
