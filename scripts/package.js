import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unpacked = path.join(root, 'dist', 'unpacked');

if (!fs.existsSync(path.join(unpacked, 'manifest.json'))) {
  console.error('dist/unpacked is missing. Run npm run build first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(unpacked, 'manifest.json'), 'utf8'));
const zipName = `zhihu-to-markdown-v${manifest.version}.zip`;
const zipPath = path.join(root, 'dist', zipName);

if (process.platform === 'win32') {
  const dest = zipPath.replace(/'/g, "''");
  const source = `${unpacked}\\*`.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${source}' -DestinationPath '${dest}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${unpacked}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

const sizeKB = (fs.statSync(zipPath).size / 1024).toFixed(2);
console.log(`\nPackage created: dist/${zipName} (${sizeKB} KB)`);
console.log('Load dist/unpacked in chrome://extensions for local development.');
