// 审查 e2fa5da P3：导出的 reason 分支、result.error 抛出分支、catch 分支，以及复制的两个 catch，
// 都只显示通用文案。原始错误用一个独特的中文串，断言它不出现在 tooltip、aria-label、live region 里，
// 能杀死「直接显示原始错误」的变异。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const RAW = '原始错误⚑RAWX-1729';
const en = JSON.parse(fs.readFileSync(new URL('../_locales/en/messages.json', import.meta.url), 'utf8'));
const getMessage = (key, subs = []) => { const m = en[key]; if (!m) return ''; const ph = m.placeholders || {}; return m.message.replace(/\$(\w+)\$/g, (_, n) => (ph[n.toLowerCase()]?.content || '').replace(/\$(\d)/g, (__, i) => subs[i - 1] ?? '')); };
const { window, document } = parseHTML('<!doctype html><html><body><p id="sel">hello selection</p></body></html>');
globalThis.window = window; globalThis.document = document;
globalThis.chrome = { i18n: { getMessage }, storage: {}, runtime: { sendMessage: async () => ({}) } };
globalThis.setTimeout = () => 0;
const rawErr = () => Object.assign(new Error(RAW), { name: RAW });
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw rawErr(); }, write: async () => { throw rawErr(); } } }, configurable: true });
document.execCommand = () => { throw rawErr(); };
// linkedom 没有 setSelectionRange；补上，让失败确实来自剪贴板（原始错误），不是测试环境
for (const k of ['setSelectionRange', 'focus']) window.HTMLTextAreaElement.prototype[k] ||= () => {};

const { FloatingBall } = await import('../content/modules/floating-ball.js');
const { ArticleExporter } = await import('../content/modules/exporters/article.js');
const { PageDetector } = await import('../content/modules/detector.js');
PageDetector.detectPageType = () => 'article';
console.error = () => {};
const ball = FloatingBall.createFloatingBall(); document.body.appendChild(ball);
const shown = () => [ball.querySelector('.tooltip').textContent, ball.getAttribute('aria-label') || '', document.getElementById('zhihu-md-live')?.textContent || ''];
const check = (name, want) => {
  const s = shown();
  for (const x of s) {
    assert.ok(!x.includes(RAW) && !x.includes('RAWX') && !x.includes('原始错误'), `${name}：出现了原始错误 ${x}`);
  }
  assert.ok(ball.classList.contains('error'), `${name}：不是错误态`);
  if (want) assert.equal(s[0], want, `${name}：tooltip`);
  assert.ok(s[2].includes(s[0]), `${name}：live region 要播报同一条通用文案`);
};

// 1) result.reason 分支（floating-ball.js 的 else if (result.reason)）
ArticleExporter.exportMarkdown = async () => ({ success: false, reason: 'login_required', error: RAW });
FloatingBall.busy = false; await FloatingBall.handleBallClick(ball);
check('export reason', getMessage('failLoginRequired') || undefined);
// 2) 没有 reason、只有 error → throw → catch
ArticleExporter.exportMarkdown = async () => ({ success: false, error: RAW });
FloatingBall.busy = false; await FloatingBall.handleBallClick(ball);
check('export result.error', 'Export failed. Refresh the Zhihu page and try again');
// 3) exporter 直接抛错 → catch
ArticleExporter.exportMarkdown = async () => { throw rawErr(); };
FloatingBall.busy = false; await FloatingBall.handleBallClick(ball);
check('export throw', 'Export failed. Refresh the Zhihu page and try again');
// 4) copyMarkdown 的 catch：剪贴板写入抛原始错误
ArticleExporter.exportMarkdown = async () => ({ success: true, data: { content: 'x' } });
FloatingBall.busy = false; FloatingBall.copyMarkdown(ball); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
check('copy catch（剪贴板）');
// 5) copyMarkdown 的 catch：exporter 返回失败带原始错误
ArticleExporter.exportMarkdown = async () => ({ success: false, error: RAW });
FloatingBall.busy = false; FloatingBall.copyMarkdown(ball); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
check('copy catch（导出失败）');
// 6) copySelection 的 catch
const p = document.getElementById('sel'); const range = document.createRange(); range.selectNodeContents(p);
FloatingBall.ball = ball; ball.id = 'zhihu-md-floating-ball';
const ok = await FloatingBall.copySelection({ isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => 'hello selection' });
assert.equal(ok, false);
check('copySelection catch');
console.log('ball raw error tests passed');
