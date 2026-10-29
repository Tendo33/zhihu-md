// 检查 dist/manifest.json 引用的所有文件都存在于 dist 中，
// 并检查扩展页面（popup/options 等 HTML）引用的本地脚本、样式、图片。
// 还检查 background：Chrome 产物不能有 background.scripts，Firefox 产物必须有。
// 用法：node scripts/verify-dist.js [distDir] [--target=chrome|firefox 或 --target chrome|firefox]（默认 chrome；写错就报错）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTargetArgs } from './parse-target.js';

const parsed = parseTargetArgs(process.argv.slice(2));
const target = parsed.target;
const dist = path.resolve(parsed.rest?.find((a) => !a.startsWith('--')) || 'dist');
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

// Chrome 对 MV3 的 background.scripts 报「'background.scripts' requires manifest version of 2 or lower」
export function verifyBackground(manifest, target = 'chrome') {
  const errors = [];
  const scripts = manifest.background?.scripts;
  if (target === 'firefox') {
    if (!Array.isArray(scripts) || !scripts.length) errors.push('Firefox 产物缺少 background.scripts（Firefox 不支持 service_worker）');
  } else if (scripts !== undefined) {
    errors.push('Chrome/Edge 产物不能有 background.scripts（MV3 下 Chrome 会报错）');
  }
  if (target !== 'firefox' && !manifest.background?.service_worker) errors.push('Chrome/Edge 产物缺少 background.service_worker');
  return errors;
}

export function verifyDist(dir, target = 'chrome') {
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
  return { missing, checked, extraIcons, localeErrors: verifyLocales(dir, manifest), backgroundErrors: verifyBackground(manifest, target) };
}

// 商店多语言：messages.json 必须能解析、含必需条目且 message 非空；
// manifest 里每个 __MSG_x__ 在每种语言都要有条目；description 不超过 132 字符（Chrome 限制）。
export const REQUIRED_LOCALES = ['zh_CN', 'en'];
export const REQUIRED_MESSAGES = ['extName', 'extDescription'];
export const NAME_MAX = 75;
export const SHORT_NAME_MAX = 12;
const SHORT_NAME_KEY = /short_?name/i;
export function manifestMessageKeys(manifest) {
  const keys = new Set();
  JSON.stringify(manifest).replace(/__MSG_(\w+?)__/g, (_, k) => keys.add(k));
  return [...keys];
}
export function verifyLocales(dir, manifest) {
  const errors = [];
  const keys = manifestMessageKeys(manifest);
  if (keys.length && !manifest.default_locale) errors.push('manifest 用了 __MSG_ 但没有 default_locale');
  const locales = new Set(REQUIRED_LOCALES);
  if (manifest.default_locale) locales.add(manifest.default_locale);
  // 没用 __MSG_ 的字面值也要守住长度
  for (const [field, max] of [['name', NAME_MAX], ['short_name', SHORT_NAME_MAX]]) {
    const v = manifest[field];
    if (typeof v === 'string' && !/^__MSG_\w+__$/.test(v) && [...v].length > max) errors.push(`manifest ${field} 超过 ${max} 字符（${[...v].length}）`);
  }
  if (!keys.length && !manifest.default_locale) return errors;
  for (const loc of locales) {
    const file = path.join(dir, '_locales', loc, 'messages.json');
    if (!fs.existsSync(file)) { errors.push(`缺少 _locales/${loc}/messages.json`); continue; }
    let msgs;
    try { msgs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push(`_locales/${loc}/messages.json 无法解析：${e.message}`); continue; }
    // Chrome 对 message 名不区分大小写
    const lower = new Map(Object.entries(msgs).map(([k, v]) => [k.toLowerCase(), v]));
    for (const k of new Set([...REQUIRED_MESSAGES, ...keys])) {
      const m = lower.get(k.toLowerCase());
      if (!m || typeof m.message !== 'string' || !m.message.trim()) errors.push(`_locales/${loc}: 缺少 ${k}`);
    }
    const descKey = /^__MSG_(\w+)__$/.exec(manifest.description || '')?.[1];
    const desc = descKey && lower.get(descKey.toLowerCase())?.message;
    if (desc && [...desc].length > 132) errors.push(`_locales/${loc}: ${descKey} 超过 132 字符（${[...desc].length}）`);
    // 审查 P3：名称 ≤75、short_name ≤12（Chrome 限制）。short_name 只在 manifest 或 messages 里有时才检查
    for (const [field, max] of [['name', NAME_MAX], ['short_name', SHORT_NAME_MAX]]) {
      const key = /^__MSG_(\w+)__$/.exec(manifest[field] || '')?.[1];
      const text = key && lower.get(key.toLowerCase())?.message;
      if (text && [...text].length > max) errors.push(`_locales/${loc}: ${field}（${key}）超过 ${max} 字符（${[...text].length}）`);
    }
    if (!/^__MSG_\w+__$/.test(manifest.short_name || '')) {
      for (const [k, m] of Object.entries(msgs)) {
        const text = m && typeof m.message === 'string' ? m.message : '';
        if (SHORT_NAME_KEY.test(k) && [...text].length > SHORT_NAME_MAX) errors.push(`_locales/${loc}: short_name（${k}）超过 ${SHORT_NAME_MAX} 字符（${[...text].length}）`);
      }
    }
  }
  return errors;
}

// 用 fileURLToPath 解码 import.meta.url：路径含空格、中文时 URL.pathname 是百分号编码，
// 和 argv[1] 比不上，会导致脚本什么都不做、以 0 退出。
const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (parsed.error) {
    console.error(`verify:dist 失败：${parsed.error}`);
    process.exit(1);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`verify:dist 失败：找不到 ${manifestPath}，请先运行 npm run build`);
    process.exit(1);
  }
  if (!['chrome', 'firefox'].includes(target)) {
    console.error(`verify:dist 失败：未知的 --target=${target}`);
    process.exit(1);
  }
  const { missing, checked, extraIcons, localeErrors, backgroundErrors } = verifyDist(dist, target);
  if (backgroundErrors.length) {
    console.error(`verify:dist 失败：background 有 ${backgroundErrors.length} 个问题（target: ${target}）`);
    backgroundErrors.forEach((m) => console.error('  - ' + m));
    process.exit(1);
  }
  if (localeErrors.length) {
    console.error(`verify:dist 失败：_locales 有 ${localeErrors.length} 个问题`);
    localeErrors.forEach((m) => console.error('  - ' + m));
    process.exit(1);
  }
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
  console.log(`verify:dist 通过（target: ${target}）：检查了 ${new Set(checked).size} 个文件`);
}
