// 打包 dist/（Chrome、Edge 共用）和 dist-firefox/，并写 build/SHA256SUMS.txt。
// arxiv-md、journal-md、zhihu-md 的打包约定相同。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
const { name, version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const TARGETS = [
  { dir: 'dist', name: `${name}-v${version}-chrome.zip` },
  { dir: 'dist-firefox', name: `${name}-v${version}-firefox.zip` },
];

function zipDir(srcDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

fs.mkdirSync(buildDir, { recursive: true });
const sums = [];
for (const t of TARGETS) {
  const src = path.join(root, t.dir);
  if (!fs.existsSync(path.join(src, 'manifest.json'))) {
    console.error(`${t.dir}/ is missing. Run npm run build && npm run build:firefox first.`);
    process.exit(1);
  }
  const zipPath = path.join(buildDir, t.name);
  const bytes = await zipDir(src, zipPath);
  console.log(`Package created: build/${t.name} (${(bytes / 1024).toFixed(2)} KB)`);
  sums.push(`${sha256(zipPath)}  ${t.name}`);
}
fs.writeFileSync(path.join(buildDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
console.log('Wrote build/SHA256SUMS.txt');
console.log('The chrome zip is also the Edge Add-ons package.');
