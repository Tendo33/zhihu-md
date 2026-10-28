/** Round 3 C-3：把当前选区转成 Markdown（复用知乎 turndown 规则） */
import { createTurndownService, tidyMarkdown } from './turndown-rules.js';

export function selectionToMarkdown(selection) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
  const holder = selection.getRangeAt(0).commonAncestorContainer.ownerDocument.createElement('div');
  for (let i = 0; i < selection.rangeCount; i++) holder.appendChild(selection.getRangeAt(i).cloneContents());
  if (!holder.textContent.trim() && !holder.querySelector('img')) return '';
  return tidyMarkdown(createTurndownService(false).turndown(holder)).trim();
}
