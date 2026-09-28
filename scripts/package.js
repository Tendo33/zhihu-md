import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const buildDir = path.join(root, 'build');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const zipName = `zhihu-to-markdown-v${version}.zip`;
const zipPath = path.join(buildDir, zipName);

if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error('dist/ is missing. Run npm run build first.');
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKB = (archive.pointer() / 1024).toFixed(2);
  console.log(`Package created: build/${zipName} (${sizeKB} KB)`);
  console.log('Load dist/ in chrome://extensions for local development.');
});

archive.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

archive.pipe(output);
archive.directory(distDir, false);
await archive.finalize();
