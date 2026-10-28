import assert from 'node:assert/strict';
import { describeFailure, ExportFailure } from '../lib/failure-text.js';
import { FAILURE_MESSAGES } from '../lib/failure-reason.js';

const cases = [
  ['内容脚本返回 security_check（含 40362 限流）', new ExportFailure({ success: false, reason: 'security_check', error: FAILURE_MESSAGES.security_check }), 'export', 'security_check', /被知乎限流或需要验证/],
  ['内容脚本返回 login_required', new ExportFailure({ reason: 'login_required', error: FAILURE_MESSAGES.login_required }), 'export', 'login_required', /需要登录知乎/],
  ['内容脚本返回 not_loaded（复制）', new ExportFailure({ reason: 'not_loaded', error: FAILURE_MESSAGES.not_loaded }), 'copy', 'not_loaded', /页面未加载完/],
  ['只有错误文本、没有 reason', new Error(FAILURE_MESSAGES.login_required), 'export', 'login_required', /需要登录/],
  ['内容脚本没注入', new Error('Could not establish connection. Receiving end does not exist.'), 'export', 'not_loaded', /页面未加载完/],
  ['剪贴板被拒', new Error('NotAllowedError: Document is not focused.'), 'copy', 'clipboard', /剪贴板/],
  ['未知错误（导出）', new Error('boom'), 'export', 'unknown', /^导出失败，/],
  ['未知错误（复制）', new ExportFailure(null), 'copy', 'unknown', /^复制失败，/],
];
for (const [name, err, action, reason, re] of cases) {
  const r = describeFailure(err, action);
  assert.equal(r.reason, reason, name);
  assert.match(r.text, re, name);
  assert.notEqual(r.text, '导出失败', name);
  assert.notEqual(r.text, '复制失败', name);
  console.log('✓', name);
}
console.log(`failure-text: ${cases.length} passed`);
