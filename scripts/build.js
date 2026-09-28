import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'unpacked');

fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: {
    'content/content': 'content/content.js',
    'popup/popup': 'popup/popup.js',
    'background/background': 'background/background.js',
    'options/options': 'options/options.js',
  },
  bundle: true,
  format: 'iife',
  target: ['chrome109'],
  outdir: out,
  legalComments: 'none',
  logLevel: 'info',
});

function copyFile(rel) {
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, rel), dest);
}

copyFile('content/content.css');
copyFile('popup/popup.css');
copyFile('popup/popup.html');
copyFile('options/options.css');
copyFile('options/options.html');
copyFile('lib/shared.css');
copyFile('manifest.json');
copyFile('README.md');
copyFile('PRIVACY.md');

for (const name of fs.readdirSync(path.join(root, 'icons'))) {
  copyFile(path.join('icons', name));
}

function useBundledScript(html, scriptName) {
  const withoutScripts = html.replace(/\s*<script\s+src="[^"]+"><\/script>/g, '');
  return withoutScripts.replace('</body>', `  <script src="${scriptName}"></script>\n</body>`);
}

const popupHtmlPath = path.join(out, 'popup/popup.html');
fs.writeFileSync(popupHtmlPath, useBundledScript(fs.readFileSync(popupHtmlPath, 'utf8'), 'popup.js'));
const optionsHtmlPath = path.join(out, 'options/options.html');
fs.writeFileSync(optionsHtmlPath, useBundledScript(fs.readFileSync(optionsHtmlPath, 'utf8'), 'options.js'));

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
manifest.background.service_worker = 'background/background.js';
manifest.content_scripts[0].js = ['content/content.js'];
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`built ${out}`);
