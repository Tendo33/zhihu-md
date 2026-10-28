// Round 3：解析 CSS 颜色并算 WCAG 对比度。支持 #hex、rgb()/rgba()（含 "r g b / a" 写法）、
// transparent、var() 链、嵌套 color-mix(in srgb, A p%, B q%)。
// color-mix 按 CSS Color 5：缺省百分比互补、总和归一、按 alpha 预乘插值（设计稿 measure.js 把百分比套反了，且忽略透明）。
export function parseTokens(css, selectorTest) {
  const vars = {};
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorTest(m[1].trim())) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) vars[d[1]] = d[2].trim();
  }
  return vars;
}
function splitTop(s) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim()); return out;
}
export function resolve(value, vars, depth = 0) {
  if (depth > 20) throw new Error('var 循环: ' + value);
  const v = value.trim();
  if (v === 'transparent') return [0, 0, 0, 0];
  if (v === '#fff' || v === 'white') return [255, 255, 255, 1];
  let m = v.match(/^var\((--[\w-]+)\s*(?:,(.*))?\)$/);
  if (m) {
    if (vars[m[1]] != null) return resolve(vars[m[1]], vars, depth + 1);
    if (m[2]) return resolve(m[2], vars, depth + 1);
    throw new Error('未定义 ' + m[1]);
  }
  m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = v.match(/^rgba?\((.*)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number.parseFloat);
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  m = v.match(/^color-mix\(\s*in srgb\s*,(.*)\)$/s);
  if (m) {
    const [a, b] = splitTop(m[1]).map((part) => {
      const pm = part.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/s);
      return { c: resolve(pm[1], vars, depth + 1), p: pm[2] != null ? Number(pm[2]) / 100 : null };
    });
    let pa = a.p; let pb = b.p;
    if (pa == null && pb == null) { pa = 0.5; pb = 0.5; } else if (pa == null) pa = 1 - pb; else if (pb == null) pb = 1 - pa;
    const sum = pa + pb; const scale = Math.min(sum, 1); pa /= sum; pb /= sum;
    const alpha = a.c[3] * pa + b.c[3] * pb;
    const rgb = [0, 1, 2].map((i) => (alpha === 0 ? 0 : (a.c[i] * a.c[3] * pa + b.c[i] * b.c[3] * pb) / alpha));
    return [...rgb, alpha * scale];
  }
  throw new Error('不支持的颜色: ' + v);
}
/** 把带透明度的前景叠到不透明背景上 */
export function over(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat(1);
}
const lum = (c) => {
  const l = c.slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
export function ratio(fg, bg) {
  const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
