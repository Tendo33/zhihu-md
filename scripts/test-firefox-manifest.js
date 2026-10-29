// 发版 QA ZR-08：Firefox 需要 gecko id 和 background.scripts 兜底（与 service_worker 同一个文件）
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(new URL('../manifest.src.json', import.meta.url), 'utf8'));
assert.equal(m.browser_specific_settings?.gecko?.id, 'zhihu-md@tendo33');
assert.deepEqual(m.background.scripts, [m.background.service_worker]);
console.log('firefox manifest tests passed');
