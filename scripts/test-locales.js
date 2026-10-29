// 商店多语言：manifest 的 __MSG_ 条目、_locales 内容、verify:dist 的 locale 校验
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyLocales, manifestMessageKeys } from './verify-dist.js';

const root = new URL('..', import.meta.url);
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, root), 'utf8'));
const m = read('manifest.src.json');
assert.equal(m.name, '__MSG_extName__');
assert.equal(m.description, '__MSG_extDescription__');
assert.equal(m.default_locale, 'zh_CN');
// Z85-01：commands description 走 i18n；action.default_title 仍是字面量
assert.equal(m.commands['export-page'].description, '__MSG_cmdExportPage__');
const zh = read('_locales/zh_CN/messages.json');
const en = read('_locales/en/messages.json');
assert.equal(zh.extName.message, 'Zhihu to Markdown');
assert.equal(en.extName.message, 'Zhihu to Markdown');
assert.equal(zh.extDescription.message, '把知乎专栏、回答、问题页和热榜转换为 Markdown，保留公式、代码和图片，一键下载或复制。');
assert.equal(en.extDescription.message, 'Convert Zhihu columns, answers, question pages and hot lists to Markdown, with math, code and images kept. Download or copy.');
for (const msgs of [zh, en]) for (const v of Object.values(msgs)) assert.ok(v.description, '每条 message 都要有 description');
assert.equal(zh.cmdExportPage.message, '导出当前页为 Markdown', '中文文案不变');
assert.equal(en.cmdExportPage.message, 'Export current page as Markdown');
const MENU = { menuPageExport: '导出本页为 Markdown', menuPageCopy: '复制本页 Markdown', menuSelectionCopy: '复制选中内容为 Markdown', menuLinkExport: '打开并导出这个知乎链接' };
for (const [k, v] of Object.entries(MENU)) { assert.equal(zh[k].message, v, k + ' 中文不变'); assert.ok(en[k].message && en[k].message !== v, k + ' 有英文'); }
assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), '两种语言条目一致');
assert.deepEqual(manifestMessageKeys(m).sort(), ['cmdExportPage', 'extDescription', 'extName']);
// 源目录本身就能过校验
assert.deepEqual(verifyLocales(fileURLPath(root), m), []);

// 反例
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhihu-md-loc-'));
const put = (loc, obj) => { fs.mkdirSync(path.join(dir, '_locales', loc), { recursive: true }); fs.writeFileSync(path.join(dir, '_locales', loc, 'messages.json'), typeof obj === 'string' ? obj : JSON.stringify(obj)); };
const ok = { extName: { message: 'X' }, extDescription: { message: 'Y' }, cmdExportPage: { message: 'Z' } };
put('zh_CN', ok); put('en', ok);
assert.deepEqual(verifyLocales(dir, m), []);
assert.match(verifyLocales(dir, { ...m, short_name: '__MSG_extShort__' }).join('\n'), /zh_CN: 缺少 extShort[\s\S]*en: 缺少 extShort/);
assert.match(verifyLocales(dir, { ...m, default_locale: undefined }).join('\n'), /没有 default_locale/);
put('en', '{ bad json');
assert.match(verifyLocales(dir, m).join('\n'), /en\/messages\.json 无法解析/);
put('en', { extName: { message: 'X' }, cmdExportPage: { message: 'Z' } });
assert.match(verifyLocales(dir, m).join('\n'), /en: 缺少 extDescription/);
put('en', { extName: { message: 'X' }, extDescription: { message: 'a'.repeat(133) }, cmdExportPage: { message: 'Z' } });
assert.match(verifyLocales(dir, m).join('\n'), /超过 132 字符/);
fs.rmSync(path.join(dir, '_locales', 'en'), { recursive: true });
assert.match(verifyLocales(dir, m).join('\n'), /缺少 _locales\/en\/messages\.json/);
fs.rmSync(dir, { recursive: true, force: true });
console.log('locales tests passed');

function fileURLPath(u) { return decodeURIComponent(new URL(u).pathname); }
