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

// 审查 P3-1：同一 key 在 zh_CN 和 en 里占位符的集合和出现顺序都一致，且每个占位符映射到同一个 $n。
// 目前没有因语序需要调换顺序的条目；以后真要调换，改成只比对集合，并在这里写明是哪个 key、为什么。
const phOrder = (m) => [...m.message.matchAll(/\$(\w+)\$/g)].map(([, n]) => `${n.toLowerCase()}=${(m.placeholders || {})[n.toLowerCase()]?.content}`);
for (const k of Object.keys(zh)) {
  assert.deepEqual(phOrder(en[k]), phOrder(zh[k]), `${k} 的占位符顺序/编号 zh_CN 与 en 不一致`);
  assert.deepEqual(Object.keys(en[k].placeholders || {}).sort(), Object.keys(zh[k].placeholders || {}).sort(), `${k} 的占位符集合不一致`);
}

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
// 审查 P3-3：悬浮球新增条目的 description 用英文（给译者看），两份 locale 一致
for (const k of Object.keys(ZH_FALLBACK)) {
  for (const [loc, m] of [['en', en], ['zh_CN', zh]]) assert.ok(m[k].description && !CJK.test(m[k].description), `${loc} ${k} 的 description 不是英文`);
  assert.equal(en[k].description, zh[k].description, `${k} 的 description 两份 locale 不一致`);
}

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
// 审查 P3-3：英文单复数（1 image / N images），aria 完成提示不重复 again；中文单复数同一句
{
  const { tn } = await import('../content/modules/i18n.js');
  assert.equal(tn('ballExportedImagesFailed', 1), 'Exported. 1 image couldn\'t be downloaded; online link kept');
  assert.equal(tn('ballExportedImagesFailed', 2), 'Exported. 2 images couldn\'t be downloaded; online links kept');
  assert.equal(tn('ballImagesFailed', 1), '1 image couldn\'t be downloaded; online link kept');
  assert.equal(tn('ballImagesKept', 1), '1 image kept as an online link');
  assert.equal(tn('ballImagesKept', 3), '3 images kept as online links');
  assert.equal(t('ballAriaDone', 'Exported'), 'Exported. Click to export again');
  for (const k of Object.keys(en)) assert.ok(!/again.*again/i.test(en[k].message), `${k} 英文文案：${en[k].message}`);
  for (const k of ['ballExportedImagesFailed', 'ballImagesFailed', 'ballImagesKept']) assert.equal(zhGet(`${k}One`, ['1']), zhGet(k, ['1']));
}
// 审查 P3-1：带占位符的条目断言完整英文（编号错位时会渲染出错误数字）
assert.equal(t('ballPartial', 3, 10, 7), 'Partial export: 3/10 items exported, 7 couldn\'t load');
assert.equal(t('ballExportedImagesFailed', 2), 'Exported. 2 images couldn\'t be downloaded; online links kept');
assert.equal(t('ballAriaError', 'X'), 'Export failed: X. Press Enter to retry');
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
// 审查 P3-2：导出失败的 catch 分支（floating-ball.js 的 try/catch）。exporter 抛出或返回内部中文错误时，
// tooltip、aria-label 和播报里都只能是英文的通用失败文案
{
  const { ArticleExporter } = await import('../content/modules/exporters/article.js');
  const { PageDetector } = await import('../content/modules/detector.js');
  const saved = { detect: PageDetector.detectPageType, exp: ArticleExporter.exportMarkdown };
  PageDetector.detectPageType = () => 'article';
  const cases = [
    () => { throw new Error('导出失败: 无法解析内容'); },
    async () => ({ success: false, error: '无法解析内容' }),
  ];
  for (const impl of cases) {
    ArticleExporter.exportMarkdown = impl;
    FloatingBall.busy = false;
    await FloatingBall.handleBallClick(ball);
    const shown = [ball.querySelector('.tooltip').textContent, ball.getAttribute('aria-label'), live()];
    for (const x of shown) assert.ok(!CJK.test(x), `catch 分支 en 下含中文：${x}`);
    assert.equal(shown[0], 'Export failed. Refresh the Zhihu page and try again');
    assert.ok(ball.classList.contains('error'));
  }
  // 审查 P3-3：成功路径上 1 张图失败时，tooltip 和读屏用单数
  ArticleExporter.exportMarkdown = async () => ({ success: true, data: { filename: 'a.md', content: '' } });
  globalThis.chrome.runtime.sendMessage = async () => ({ failedImages: 1, keptImages: 1 });
  FloatingBall.busy = false;
  await FloatingBall.handleBallClick(ball);
  assert.equal(ball.querySelector('.tooltip').textContent, 'Exported. 1 image couldn\'t be downloaded; online link kept');
  assert.ok(!/\b1 images\b/.test(live() + ball.getAttribute('aria-label')), `读屏单数：${live()}`);
  PageDetector.detectPageType = saved.detect; ArticleExporter.exportMarkdown = saved.exp;
}
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
