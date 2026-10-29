// 设计验收 B1：说明文字按短语包了 <span class="nw">，文案断言统一按 textContent 比对，不看标签
import { parseHTML } from 'linkedom';
export function descText(html, key) {
  const el = parseHTML(html).document.getElementById(`desc-${key}`);
  return el ? el.textContent : null;
}
