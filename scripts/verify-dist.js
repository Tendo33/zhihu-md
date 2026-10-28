// 检查 dist/manifest.json 引用的所有文件都存在于 dist 中，
// 并检查扩展页面（popup/options 等 HTML）引用的本地脚本、样式、图片。
// 用法：node scripts/verify-dist.js [distDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(process.argv[2] || 'dist');
const manifestPath = path.join(dist, 'manifest.json');

export function manifestFiles(manifest) {
  const files = [];
  const add = (where, value) => {
    if (typeof value === 'string' && value) files.push({ where, file: value });
  };
  const addMap = (where, obj) => {
    if (typeof obj === 'string') add(where, obj);
    else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) add(`${where}.${k}`, v);
  };

  addMap('icons', manifest.icons);
  for (const key of ['action', 'browser_action', 'page_action']) {
    if (!manifest[key]) continue;
    add(`${key}.default_popup`, manifest[key].default_popup);
    addMap(`${key}.default_icon`, manifest[key].default_icon);
  }
  add('options_page', manifest.options_page);
  add('options_ui.page', manifest.options_ui?.page);
  add('devtools_page', manifest.devtools_page);
  add('side_panel.default_path', manifest.side_panel?.default_path);
  add('background.service_worker', manifest.background?.service_worker);
  add('background.page', manifest.background?.page);
  (manifest.background?.scripts || []).forEach((f, i) => add(`background.scripts[${i}]`, f));
  addMap('chrome_url_overrides', manifest.chrome_url_overrides);
  (manifest.content_scripts || []).forEach((cs, i) => {
    (cs.js || []).forEach((f, j) => add(`content_scripts[${i}].js[${j}]`, f));
    (cs.css || []).forEach((f, j) => add(`content_scripts[${i}].css[${j}]`, f));
  });
  (manifest.web_accessible_resources || []).forEach((war, i) => {
    (typeof war === 'string' ? [war] : war.resources || []).forEach((f, j) => {
      if (!f.includes('*')) add(`web_accessible_resources[${i}][${j}]`, f);
    });
  });
  if (manifest.default_locale) add('default_locale', `_locales/${manifest.default_locale}/messages.json`);
  return files;
}

export function htmlRefs(html) {
  const refs = [];
  const re = /<(?:script|link|img)\b[^>]*?\s(?:src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const ref = m[1];
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    refs.push(ref.split(/[?#]/)[0]);
  }
  return refs;
}

export function verifyDist(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const missing = [];
  const checked = [];
  for (const { where, file } of manifestFiles(manifest)) {
    const abs = path.join(dir, file.replace(/^\//, ''));
    checked.push(file);
    if (!fs.existsSync(abs)) {
      missing.push(`${where}: ${file}`);
      continue;
    }
    if (/\.html?$/i.test(file)) {
      for (const ref of htmlRefs(fs.readFileSync(abs, 'utf8'))) {
        const refAbs = ref.startsWith('/') ? path.join(dir, ref) : path.join(path.dirname(abs), ref);
        checked.push(path.relative(dir, refAbs));
        if (!fs.existsSync(refAbs)) missing.push(`${file} 引用: ${ref}`);
      }
    }
  }
  // R3 perf（复审建议 1）：dist/icons 只能有 manifest 引用的图标（构建时过滤掉了未引用的 icons/icon.png）
  const usedIcons = new Set(manifestFiles(manifest).filter(({ where }) => /^(icons|action\.default_icon)\b/.test(where)).map(({ file }) => file.replace(/^\//, '')));
  const iconDir = path.join(dir, 'icons');
  const extraIcons = fs.existsSync(iconDir)
    ? fs.readdirSync(iconDir).map((n) => `icons/${n}`).filter((f) => !usedIcons.has(f))
    : [];
  return { missing, checked, extraIcons };
}

// 用 fileURLToPath 解码 import.meta.url：路径含空格、中文时 URL.pathname 是百分号编码，
// 和 argv[1] 比不上，会导致脚本什么都不做、以 0 退出。
const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!fs.existsSync(manifestPath)) {
    console.error(`verify:dist 失败：找不到 ${manifestPath}，请先运行 npm run build`);
    process.exit(1);
  }
  const { missing, checked, extraIcons } = verifyDist(dist);
  if (extraIcons.length) {
    console.error(`verify:dist 失败：dist/icons 有 ${extraIcons.length} 个 manifest 未引用的图标`);
    extraIcons.forEach((m) => console.error('  - ' + m));
    process.exit(1);
  }
  if (missing.length) {
    console.error(`verify:dist 失败：${missing.length} 个文件缺失`);
    missing.forEach((m) => console.error('  - ' + m));
    process.exit(1);
  }
  console.log(`verify:dist 通过：检查了 ${new Set(checked).size} 个文件`);
}
