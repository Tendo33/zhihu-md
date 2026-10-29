import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 目标浏览器：默认 chrome（Chrome / Edge，产出 dist/）；--target=firefox 产出 dist-firefox/。
// Chrome 对 MV3 的 background.scripts 报「requires manifest version of 2 or lower」，
// 所以 Chrome 包去掉 scripts；Firefox 不支持 service_worker，Firefox 包保留 scripts。
const target = (process.argv.find((a) => a.startsWith('--target='))?.slice(9) || 'chrome').toLowerCase();
if (!['chrome', 'firefox'].includes(target)) {
  console.error(`未知的 --target=${target}，只支持 chrome / firefox`);
  process.exit(1);
}
const out = path.join(root, target === 'firefox' ? 'dist-firefox' : 'dist');

fs.rmSync(out, { recursive: true, force: true });
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
  minify: true, // R3 perf：内容脚本每个知乎页面都注入

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
copyFile('lib/ui-v2.css');
// The source manifest references unbundled modules, so it is named
// manifest.src.json to stop Chrome from loading the repo root by mistake.
fs.copyFileSync(path.join(root, 'manifest.src.json'), path.join(out, 'manifest.json'));
// 商店多语言：name / description 用 __MSG_*__，_locales 必须打进 dist 和 zip
fs.cpSync(path.join(root, '_locales'), path.join(out, '_locales'), { recursive: true });
copyFile('README.md');
copyFile('PRIVACY.md');

// R3 perf：只复制 manifest 引用的图标（icons/icon.png 102 KB 未被引用）
const srcManifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.src.json'), 'utf8'));
const usedIcons = new Set([
  ...Object.values(srcManifest.icons || {}),
  ...Object.values(srcManifest.action?.default_icon || {}),
]);
for (const name of fs.readdirSync(path.join(root, 'icons'))) {
  const rel = path.join('icons', name);
  if (usedIcons.has(rel.split(path.sep).join('/'))) copyFile(rel);
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
if (target === 'chrome') delete manifest.background.scripts;
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`built ${out} (target: ${target})`);
