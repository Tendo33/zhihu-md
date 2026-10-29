// batch8：渲染校验公用部分（test-html-like-text / test-fixtures 共用）。
// - markdown-it 不进依赖：依次找本仓库 node_modules、MD_RENDERER_DIR、E2E_PLAYWRIGHT_DIR。
//   设置了 MD_RENDERER_DIR 却加载不到 markdown-it 时直接抛错（不静默退回兜底检查）。
// - 公式在 DOM 阶段遮蔽：把 data-tex 换成纯字母数字占位符，再走同一套 turndown；
//   不再对导出的 Markdown 做 $…$ 正则替换（那样会把两个货币 $ 之间的内容一起藏掉）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadMarkdownIt() {
  const dirs = [root, process.env.MD_RENDERER_DIR, process.env.E2E_PLAYWRIGHT_DIR].filter(Boolean);
  for (const d of dirs) {
    try {
      const req = createRequire(path.join(d, 'package.json'));
      const MarkdownIt = req('markdown-it');
      const pkgDir = path.dirname(req.resolve('markdown-it/package.json', { paths: [d] }));
      const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
      return { MarkdownIt, version };
    } catch { /* next */ }
  }
  if (process.env.MD_RENDERER_DIR) {
    throw new Error(`rendered check: 设置了 MD_RENDERER_DIR=${process.env.MD_RENDERER_DIR}，但加载不到 markdown-it（查找过：${dirs.join(', ')}）`);
  }
  return null;
}

// 与 turndown-rules.js 的 zhihuMath 规则同一 filter：有 data-tex，且是 .ztext-math 或没有子元素
export function maskMathInDom(rootEl) {
  let i = 0;
  for (const el of rootEl.querySelectorAll('[data-tex]')) {
    if (el.classList.contains('ztext-math') || el.children.length === 0) {
      el.setAttribute('data-tex', `ZMATH${i}`);
      el.textContent = `ZMATH${i}`;
      i += 1;
    }
  }
  return rootEl;
}

export function htmlTokens(MarkdownIt, md) {
  const found = [];
  const walk = (tokens) => tokens.forEach((tk) => {
    if (tk.type === 'html_block' || tk.type === 'html_inline') found.push(tk.content);
    if (tk.children) walk(tk.children);
  });
  walk(new MarkdownIt({ html: true }).parse(md, {}));
  return found;
}

export function summaryLine(version, samples, tokens) {
  return `rendered check: markdown-it ${version}, ${samples} samples, ${tokens} html tokens`;
}
