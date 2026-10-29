// 注入页 i18n：悬浮球 tooltip、读屏名称、状态和失败文案都走 _locales；en 下不能出现中文，zh_CN 文案不变
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

const root = new URL('..', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), 'utf8');
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
const en = JSON.parse(read('_locales/en/messages.json'));
const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/u;

// 两种语言条目完全一致
assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'zh_CN 和 en 的 key 必须一致');

// 按 chrome.i18n 规则（命名占位符 → $n）渲染
function getMessageFrom(msgs) {
  return (key, subs = []) => {
    const m = msgs[key]; if (!m) return '';
    const ph = m.placeholders || {};
    return m.message.replace(/\$(\w+)\$/g, (_, name) => (ph[name.toLowerCase()]?.content || '').replace(/\$(\d)/g, (__, i) => subs[i - 1] ?? ''));
  };
}

const { t, ZH_FALLBACK } = await import('../content/modules/i18n.js');
// 中文回退与 zh_CN/messages.json 逐条一致；每个 key 两种语言都有
const zhGet = getMessageFrom(zh);
for (const k of Object.keys(ZH_FALLBACK)) {
  assert.ok(zh[k] && en[k], `${k} 两种语言都要有`);
  assert.equal(zhGet(k, ['$1', '$2', '$3']), ZH_FALLBACK[k], `${k} 中文回退要和 zh_CN 一致`);
}
// getMessage 返回空 / 抛错时回退中文
globalThis.chrome = { i18n: { getMessage: () => '' } };
assert.equal(t('ballTooltipIdle'), '点击下载 · 右键复制');
globalThis.chrome = { i18n: { getMessage: () => { throw new Error('x'); } } };
assert.equal(t('ballPartial', 1, 3, 2), '部分导出：已导出 1/3 条，2 条未能加载');

// 中文界面：文案保持不变
globalThis.chrome = { i18n: { getMessage: zhGet }, storage: {}, runtime: {} };
assert.equal(t('ballTooltipIdle'), '点击下载 · 右键复制');
assert.equal(t('ballAriaIdle'), '导出 Markdown（点击下载，右键复制）');

// 英文界面：渲染悬浮球并跑一遍各状态
globalThis.chrome = { i18n: { getMessage: getMessageFrom(en) }, storage: {}, runtime: {} };
assert.equal(t('ballTooltipIdle'), 'Click to export · Right-click to copy');
assert.equal(t('ballAriaIdle'), 'Export Markdown (click to download, right-click to copy)');
for (const k of Object.keys(ZH_FALLBACK)) assert.ok(!CJK.test(t(k, 1, 2, 3)), `en 下 ${k} 含中文：${t(k, 1, 2, 3)}`);

const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
globalThis.window = window; globalThis.document = document;
const realSetTimeout = globalThis.setTimeout; globalThis.setTimeout = () => 0;
const { FloatingBall } = await import('../content/modules/floating-ball.js?i18n');
const { ballA11y } = await import('../content/modules/ball-a11y.js');
const { ballImageSrExtra, ballKeptSrExtra, ballFailureText } = await import('../content/modules/ball-text.js');
const ball = FloatingBall.createFloatingBall();
assert.equal(ball.querySelector('.tooltip').textContent, 'Click to export · Right-click to copy');
// R12：两个不换行短语，空格在 span 外；拼起来仍是整句，且不含中文
{
  const tip = ball.querySelector('.tooltip');
  const nws = [...tip.querySelectorAll('span.nw')];
  assert.deepEqual(nws.map((n) => n.textContent), ['Click to export ·', 'Right-click to copy']);
  assert.equal(tip.childNodes.length, 3);
  assert.equal(tip.childNodes[1].nodeType, 3); assert.equal(tip.childNodes[1].textContent, ' ');
  assert.equal(`${t('ballTooltipIdlePart1')} ${t('ballTooltipIdlePart2')}`, t('ballTooltipIdle'));
  assert.equal(`${t('ballTooltipIdlePart1')} ${t('ballTooltipIdlePart2')}`, 'Click to export · Right-click to copy');
  assert.ok(!CJK.test(tip.textContent));
  const zhJoin = `${zhGet('ballTooltipIdlePart1')} ${zhGet('ballTooltipIdlePart2')}`;
  assert.equal(zhJoin, zhGet('ballTooltipIdle'));
  assert.equal(zhJoin, '点击下载 · 右键复制');
  // 状态文字仍是纯文本；回到空闲时恢复分段结构
  FloatingBall.setMessage(ball, t('ballExporting'), 'loading');
  assert.equal(tip.querySelectorAll('span.nw').length, 0);
  FloatingBall.setMessage(ball, t('ballTooltipIdle'), 'normal');
  assert.equal(tip.querySelectorAll('span.nw').length, 2);
  assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML/.test(read('content/modules/floating-ball.js')), 'floating-ball.js 不用 innerHTML');
}
assert.equal(ball.getAttribute('aria-label'), 'Export Markdown (click to download, right-click to copy)');
assert.ok(!CJK.test(ball.getAttribute('aria-label')), 'en 下 aria-label 不含中文');
const texts = [];
const live = () => document.getElementById('zhihu-md-live')?.textContent || '';
let g = 0;
const finish = (...a) => { FloatingBall.operation = ++g; FloatingBall.finishBall(ball, g, ...a); texts.push(ball.querySelector('.tooltip').textContent, ball.getAttribute('aria-label'), live()); };
finish('success', t('ballExportedImagesFailed', 2), ballKeptSrExtra(2, 3));
finish('success', t('ballExported'), ballKeptSrExtra(0, 3));
finish('warning', t('ballPartial', 3, 10, 7), ballImageSrExtra(1, 2), t('ballPartialSep'));
for (const r of ['security_check', 'login_required', 'not_loaded', 'unsupported', undefined]) finish('error', ballFailureText({ reason: r }, 'export'));
finish('error', ballFailureText(new Error('NotAllowedError: clipboard'), 'copy'));
finish('error', ballFailureText(new Error('boom'), 'copy'));
FloatingBall.copySelection({ toString: () => '', rangeCount: 0, isCollapsed: true });
texts.push(ball.querySelector('.tooltip').textContent, ball.getAttribute('aria-label'));
for (const s of ['loading', 'success', 'warning', 'error', 'normal']) texts.push(ballA11y(s).label, ballA11y(s, 'Copying…').label);
for (const s of texts) assert.ok(!CJK.test(s), `en 下注入页文字含中文：${s}`);
assert.ok(texts.includes('Export failed: Sign in to Zhihu to see this content, then export again. Press Enter to retry'));
globalThis.setTimeout = realSetTimeout;

// 源码兜底：注入页面向用户的模块里，除注释和内部 Error 外不再有中文字面量；CSS content: 也不带中文
const UI = ['content/modules/floating-ball.js', 'content/modules/ball-a11y.js', 'content/modules/ball-text.js', 'content/modules/floating-ball-drag.js', 'content/content.js'];
const INTERNAL = /new Error\(|Logger\.|console\./;
for (const f of UI) {
  read(f).split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\/\*\*?|\*).*$/, '');
    const lits = [...code.matchAll(/'([^'\n]*)'|`([^`\n]*)`|"([^"\n]*)"/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    if (lits.some((x) => CJK.test(x)) && !INTERNAL.test(code)) assert.fail(`${f}:${i + 1} 写死中文：${line.trim()}`);
  });
}
for (const m of read('content/content.css').matchAll(/content\s*:\s*([^;]+);/g)) assert.ok(!CJK.test(m[1]), `content.css content: 含中文 ${m[1]}`);
console.log('content i18n tests passed');
