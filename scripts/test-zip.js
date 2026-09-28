import assert from 'assert';
import { crc32, createZip } from '../lib/zip.js';

const content = new TextEncoder().encode('hi');
const checksum = crc32(content);
const zip = createZip([{ name: '笔记.md', content }]);
const bytes = new Uint8Array(await zip.arrayBuffer());

assert.strictEqual(bytes[0], 0x50);
assert.strictEqual(bytes[1], 0x4b);
assert.strictEqual(bytes[2], 0x03);
assert.strictEqual(bytes[3], 0x04);

const view = new DataView(bytes.buffer);
assert.strictEqual(view.getUint16(6, true), 0x0800);
assert.strictEqual(view.getUint32(14, true), checksum);
assert.strictEqual(view.getUint32(18, true), content.length);
assert.strictEqual(view.getUint32(22, true), content.length);

const nameLength = view.getUint16(26, true);
const name = new TextDecoder().decode(bytes.slice(30, 30 + nameLength));
assert.strictEqual(name, '笔记.md');

const eocd = bytes.length - 22;
assert.strictEqual(view.getUint32(eocd, true), 0x06054b50);
assert.strictEqual(view.getUint16(eocd + 10, true), 1);

console.log('zip assertions passed');
