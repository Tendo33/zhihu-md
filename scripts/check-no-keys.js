// 源码和 dist 里不能出现字面量 Key（sk-…、Bearer 加长串、JWT、常见云厂商 Key）。
// 与 arxiv-md / journal-md 的 scripts/check-no-keys.js 同一组规则。
// 用法：node scripts/check-no-keys.js [目录…]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PATTERNS = [
  { name: 'sk- key', re: /\bsk-[A-Za-z0-9_-]{16,}/g },
  { name: 'Bearer literal', re: /Bearer [A-Za-z0-9._~+/=-]{20,}/g },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];
const EXT = /\.(m?js|json|html|css|md|txt|xml)$/;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

function scanText(text) {
  const hits = [];
  for (const { name, re } of PATTERNS) {
    for (const m of text.matchAll(re)) hits.push({ name, sample: `${m[0].slice(0, 12)}…` });
  }
  return hits;
}

function scan(dirs) {
  const hits = [];
  for (const file of dirs.flatMap((d) => walk(d, []))) {
    for (const h of scanText(fs.readFileSync(file, 'utf8'))) hits.push({ file, ...h });
  }
  return hits;
}

export { scan, scanText, walk, PATTERNS };

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dirs = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ['content', 'popup', 'background', 'options', 'lib', 'scripts', '_locales', 'dist', 'dist-firefox'].map((d) => path.join(root, d));
  const hits = scan(dirs);
  if (hits.length) {
    hits.forEach((h) => console.error(`${h.file}: ${h.name} ${h.sample}`));
    process.exit(1);
  }
  console.log(`check-no-keys: OK (${dirs.join(', ')})`);
}
