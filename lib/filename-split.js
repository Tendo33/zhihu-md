/**
 * 第三轮设计：「已保存」文件名单行、中间省略。把文件名拆成主名和后缀（_with_images.zip / .md / .zip 等）。
 * 纯函数：主名 + 后缀 === 原文件名。
 * @param {string} name
 * @returns {[string, string]}
 */
export function splitFilename(name) {
  const s = String(name ?? '');
  const m = s.match(/(?:_with_images)?\.[A-Za-z0-9]{1,8}$/);
  if (!m || m.index === 0) return [s, ''];
  return [s.slice(0, m.index), m[0]];
}
