// 发版 QA ZR-09：打包图片时，下载失败的图片在 Markdown 里退回原始在线链接（不留 images/ 断链），
// 审查 P3-5：扩展名先按文件头魔数判断，认不出再看 Content-Type；只接受位图格式（jpg/png/gif/webp/avif/bmp），
// SVG 和认不出的类型按下载失败处理（保留在线链接，计入失败数）。纯函数，便于单测。

const TYPE_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/pjpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp',
};

export function extFromContentType(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return TYPE_EXT[type] || null;
}

export function extFromMagic(bytes) {
  const b = bytes || [];
  const at = (i, ...v) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp';
  if (at(4, 0x66, 0x74, 0x79, 0x70) && (at(8, 0x61, 0x76, 0x69, 0x66) || at(8, 0x61, 0x76, 0x69, 0x73))) return 'avif';
  if (at(0, 0x42, 0x4d)) return 'bmp';
  return null;
}

/** 把文件名的扩展名换成 ext（没有扩展名就补上） */
export function withExt(filename, ext) {
  if (!ext) return filename;
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${stem}.${ext}`;
}

/** 图片下载只允许 https 的 zhimg.com 及其子域（代码层限制，不改 manifest 权限） */
export function isAllowedImageUrl(url) {
  try {
    const u = new URL(String(url));
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && (host === 'zhimg.com' || host.endsWith('.zhimg.com'));
  } catch {
    return false;
  }
}

export function imageFailText(n) {
  return `${n} 张图片下载失败，已保留在线链接`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} content Markdown，图片写成 ](images/<filename>)
 * @param {Array<{url, filename}>} images
 * @param {Array<{ok: boolean, data?: Uint8Array, contentType?: string}>} results 与 images 一一对应
 * @returns {{content: string, files: Array<{filename, data}>, failed: number}}
 */
export function applyImageResults(content, images, results) {
  let out = content;
  const files = [];
  let failed = 0;
  images.forEach((img, i) => {
    const r = results[i] || { ok: false };
    const link = new RegExp(`\\]\\(images/${escapeRe(img.filename)}\\)`, 'g');
    const ext = r.ok ? (extFromMagic(r.data) || extFromContentType(r.contentType)) : null;
    if (!ext) {
      failed += 1;
      out = out.replace(link, () => `](${img.url})`);
      return;
    }
    const filename = withExt(img.filename, ext);
    if (filename !== img.filename) out = out.replace(link, () => `](images/${filename})`);
    files.push({ filename, data: r.data });
  });
  return { content: out, files, failed };
}
