export async function copyText(text) {
  const value = String(text || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Some pages still reject the async clipboard API. The textarea path uses clipboardWrite.
    }
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.setSelectionRange(0, area.value.length);
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('copy failed');
}

// clipboard.write must run in the click turn. The promise keeps that
// activation alive while Markdown is still being built.
export function copyTextLater(produceText) {
  const produce = () => Promise.resolve().then(produceText).then((text) => String(text ?? ''));
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
    const item = new ClipboardItem({
      'text/plain': produce().then((text) => new Blob([text], { type: 'text/plain' })),
    });
    return navigator.clipboard.write([item]);
  }
  return produce().then((text) => copyText(text));
}
