// 发版 QA ZR-08：Firefox 需要 gecko id 和 background.scripts 兜底（与 service_worker 同一个文件）
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(new URL('../manifest.src.json', import.meta.url), 'utf8'));
assert.equal(m.browser_specific_settings?.gecko?.id, 'zhihu-md@tendo33');
assert.deepEqual(m.background.scripts, [m.background.service_worker]);
console.log('firefox manifest tests passed');

// 图标：16 / 32 / 48 / 128 四个尺寸，manifest icons 与 action.default_icon 一致，PNG 实际尺寸对得上
const want = { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
assert.deepEqual(m.icons, want);
assert.deepEqual(m.action.default_icon, want);
for (const [size, file] of Object.entries(want)) {
  const buf = fs.readFileSync(new URL('../' + file, import.meta.url));
  assert.equal(buf.readUInt32BE(16), Number(size), file + ' 宽');
  assert.equal(buf.readUInt32BE(20), Number(size), file + ' 高');
}
console.log('icon manifest tests passed');

// web-ext MISSING_DATA_COLLECTION_PERMISSIONS：扩展不收集/外发用户数据，声明 none
{
  const m = JSON.parse(fs.readFileSync(new URL('../manifest.src.json', import.meta.url), 'utf8'));
  assert.deepEqual(m.browser_specific_settings?.gecko?.data_collection_permissions, { required: ['none'] });
  console.log('data collection permissions test passed');
}
