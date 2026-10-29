/**
 * 不用 innerHTML 的 DOM 构建工具（web-ext UNSAFE_VAR_ASSIGNMENT）。
 * parseHtmlInert：知乎 API 返回的回答正文属于外部数据，用 DOMParser 解析到一个惰性文档里，
 * 不挂到当前页面：不会执行脚本、不会触发内联事件、也不会加载图片。
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

export function parseHtmlInert(html) {
  const doc = new window.DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html || ''}</body></html>`, 'text/html');
  const holder = doc.createElement('div');
  for (const n of Array.from(doc.body.childNodes)) holder.appendChild(n);
  return holder;
}

const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' };
// 勾 / 叹号：悬浮球与 popup 最近导出共用
export const ICONS = {
  check: { attrs: { ...STROKE, 'stroke-linejoin': 'round' }, children: [['path', { d: 'M5 12l5 5L20 7' }]] },
  warn: { attrs: { ...STROKE, 'stroke-linejoin': 'round' }, children: [['path', { d: 'M12 3 2 20h20L12 3z' }], ['path', { d: 'M12 10v4M12 17v.5' }]] },
  alert: { attrs: STROKE, children: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 8v5M12 16v.5' }]] },
};

export function svgIcon(name, className) {
  const spec = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (className) svg.setAttribute('class', className);
  const base = { 'aria-hidden': 'true', width: '16', height: '16', viewBox: '0 0 24 24', ...spec.attrs };
  for (const [k, v] of Object.entries(base)) svg.setAttribute(k, v);
  for (const [tag, attrs] of spec.children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

export function span(className, text, attrs = {}) {
  const el = document.createElement('span');
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
