/**
 * R12：悬浮球提示的定位。提示四边到视口都留 ≥ EDGE（8px），球拖到哪里都成立。
 * 纯计算（planTooltip）和 DOM 读写（placeTooltip）分开，方便单测。
 */
export const EDGE = 8; // 提示到视口边缘的最小距离
export const GAP = 16; // 球和提示的间距（原 right: 60px = 球宽 44 + 16）
export const HOVER_LIFT = 2; // 悬停时球上移 2px（translateY(-2px)），提示跟着移，上边多留出来
export const MSG_CAP = 280; // 成功/失败长提示的宽度上限（沿用原 CSS）

/** 选择放在球哪一侧、给多宽：球中心在右半屏放左侧，否则放右侧（吸左时原本就放右侧） */
export function pickSide(ball, vw) {
  return ball.left + ball.width / 2 > vw / 2 ? 'left' : 'right';
}

export function sideSpace(ball, vw, side) {
  return side === 'left'
    ? ball.left - GAP - EDGE
    : vw - (ball.left + ball.width) - GAP - EDGE;
}

/**
 * 给定球的位置（不含 transform 的布局框）、视口和提示实际尺寸，算出提示在视口里的左上角。
 * placement 为 'left' / 'right'（侧边，垂直居中后夹取）或 'above' / 'below'（两侧都放不下时）。
 */
export function planTooltip({ ball, vw, vh, tw, th, placement }) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const minTop = EDGE + HOVER_LIFT;
  const maxTop = vh - EDGE - th;
  if (placement === 'left' || placement === 'right') {
    const left = placement === 'left' ? ball.left - GAP - tw : ball.left + ball.width + GAP;
    const top = clamp(ball.top + ball.height / 2 - th / 2, minTop, Math.max(minTop, maxTop));
    return { left, top };
  }
  const left = clamp(ball.left + ball.width / 2 - tw / 2, EDGE, Math.max(EDGE, vw - EDGE - tw));
  const top = placement === 'above' ? ball.top - GAP / 2 - th : ball.top + ball.height + GAP / 2;
  return { left, top: clamp(top, minTop, Math.max(minTop, maxTop)) };
}

/** 球去掉当前 transform 后的布局框（吸边 translateX(±40%)、悬停 -2px 都不算） */
function layoutBox(ball) {
  const r = ball.getBoundingClientRect();
  let dx = 0; let dy = 0;
  try {
    const m = new DOMMatrixReadOnly(getComputedStyle(ball).transform);
    dx = m.m41; dy = m.m42;
  } catch { /* 无 transform */ }
  return { left: r.left - dx, top: r.top - dy, width: r.width, height: r.height };
}

/**
 * 决定位置：measure(maxWidth) 返回在该宽度上限下提示的 { tw, th, fits }（fits=最长不换行短语放得下）。
 * 先放球中心所在半屏的另一侧；放不下换另一侧；两侧都不行就放到球上方/下方（水平夹取）。
 */
export function chooseLayout({ ball, vw, vh, cap = Infinity, measure }) {
  const width = (w) => Math.max(0, Math.floor(Math.min(w, cap)));
  const first = pickSide(ball, vw);
  const second = first === 'left' ? 'right' : 'left';
  for (const placement of [first, second]) {
    const maxWidth = width(sideSpace(ball, vw, placement));
    const m = measure(maxWidth);
    if (m.fits) return { placement, maxWidth, ...m, ...planTooltip({ ball, vw, vh, tw: m.tw, th: m.th, placement }) };
  }
  const placement = ball.top + ball.height / 2 > vh / 2 ? 'above' : 'below';
  const maxWidth = width(vw - 2 * EDGE);
  const m = measure(maxWidth);
  return { placement, maxWidth, ...m, ...planTooltip({ ball, vw, vh, tw: m.tw, th: m.th, placement }) };
}

/** 读当前球位置和提示尺寸，写提示的内联 max-width / left / top */
export function placeTooltip(ballEl) {
  const tip = ballEl?.querySelector?.('.tooltip');
  if (!tip || typeof window === 'undefined' || typeof tip.getBoundingClientRect !== 'function') return null;
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;
  if (!vw || !vh) return null;
  const ball = layoutBox(ballEl);
  const cap = /\b(success|error|warning)\b/.test(ballEl.className) ? MSG_CAP : Infinity;
  tip.style.left = '0px'; tip.style.right = 'auto';
  const nws = [...tip.querySelectorAll('.nw')];
  const measure = (maxWidth) => {
    tip.style.width = '';
    tip.style.maxWidth = `${maxWidth}px`;
    const fits = tip.scrollWidth <= tip.clientWidth + 1;
    // 折成两行时 max-content 会撑到上限宽度；收窄到最长短语，框贴着文字
    if (fits && nws.length > 1 && nws[0].getBoundingClientRect().top !== nws[nws.length - 1].getBoundingClientRect().top) {
      const cs = getComputedStyle(tip);
      const extra = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + (parseFloat(cs[k]) || 0), 0);
      tip.style.width = `${Math.ceil(Math.max(...nws.map((n) => n.getBoundingClientRect().width)) + extra)}px`;
    }
    return { tw: tip.offsetWidth, th: tip.offsetHeight, fits, width: tip.style.width };
  };
  const plan = chooseLayout({ ball, vw, vh, cap, measure });
  tip.style.maxWidth = `${plan.maxWidth}px`;
  tip.style.width = plan.width || '';
  // 提示是球的子元素（absolute），相对球的内边距框定位
  tip.style.left = `${Math.round(plan.left - ball.left - (ballEl.clientLeft || 0))}px`;
  tip.style.top = `${Math.round(plan.top - ball.top - (ballEl.clientTop || 0))}px`;
  tip.style.setProperty('--tip-ty', '0px');
  tip.style.setProperty('--tip-tx', plan.placement === 'right' ? '-8px' : plan.placement === 'left' ? '8px' : '0px');
  tip.dataset.placement = plan.placement;
  return plan;
}
