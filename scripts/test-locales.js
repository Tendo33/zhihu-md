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
// action.default_title / commands description 保持字面量，不在本次范围
assert.equal(m.commands['export-page'].description, '导出当前页为 Markdown');
const zh = read('_locales/zh_CN/messages.json');
const en = read('_locales/en/messages.json');
assert.equal(zh.extName.message, 'Zhihu to Markdown');
assert.equal(en.extName.message, 'Zhihu to Markdown');
assert.equal(zh.extDescription.message, '把知乎专栏、回答、问题页和热榜转换为 Markdown，保留公式、代码和图片，一键下载或复制。');
assert.equal(en.extDescription.message, 'Convert Zhihu columns, answers, question pages and hot lists to Markdown, with math, code and images kept. Download or copy.');
for (const msgs of [zh, en]) for (const v of Object.values(msgs)) assert.ok(v.description, '每条 message 都要有 description');
assert.deepEqual(manifestMessageKeys(m).sort(), ['extDescription', 'extName']);
// 源目录本身就能过校验
assert.deepEqual(verifyLocales(fileURLPath(root), m), []);

// 反例
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhihu-md-loc-'));
const put = (loc, obj) => { fs.mkdirSync(path.join(dir, '_locales', loc), { recursive: true }); fs.writeFileSync(path.join(dir, '_locales', loc, 'messages.json'), typeof obj === 'string' ? obj : JSON.stringify(obj)); };
const ok = { extName: { message: 'X' }, extDescription: { message: 'Y' } };
put('zh_CN', ok); put('en', ok);
assert.deepEqual(verifyLocales(dir, m), []);
assert.match(verifyLocales(dir, { ...m, short_name: '__MSG_extShort__' }).join('\n'), /zh_CN: 缺少 extShort[\s\S]*en: 缺少 extShort/);
assert.match(verifyLocales(dir, { ...m, default_locale: undefined }).join('\n'), /没有 default_locale/);
put('en', '{ bad json');
assert.match(verifyLocales(dir, m).join('\n'), /en\/messages\.json 无法解析/);
put('en', { extName: { message: 'X' } });
assert.match(verifyLocales(dir, m).join('\n'), /en: 缺少 extDescription/);
put('en', { extName: { message: 'X' }, extDescription: { message: 'a'.repeat(133) } });
assert.match(verifyLocales(dir, m).join('\n'), /超过 132 字符/);
fs.rmSync(path.join(dir, '_locales', 'en'), { recursive: true });
assert.match(verifyLocales(dir, m).join('\n'), /缺少 _locales\/en\/messages\.json/);
fs.rmSync(dir, { recursive: true, force: true });
console.log('locales tests passed');

function fileURLPath(u) { return decodeURIComponent(new URL(u).pathname); }
