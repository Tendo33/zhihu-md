// 发版 QA ZR-09：打包图片时，下载失败的图片在 Markdown 里退回原始在线链接（不留 images/ 断链），
// 审查 P3-5：扩展名只按文件头魔数判断（复审 51f7f33 起不再用 Content-Type 兜底）；只接受位图格式（jpg/png/gif/webp/avif/bmp），
// SVG 和认不出的类型不打包，保留在线链接，计入 kept（保留数，不是失败数，见 applyImageResults）。纯函数，便于单测。

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
  if (at(4, 0x66, 0x74, 0x79, 0x70) && isAvifFtyp(b, at)) return 'avif';
  if (at(0, 0x42, 0x4d)) return 'bmp';
  return null;
}

/**
 * ftyp box：size(4) 'ftyp'(4) major(4) minor(4) compatible[4×n]。
 * major brand 是 avif/avis 直接认；否则在 compatible brands 里找 avif/avis（例如 mif1 + avif）。
 * 只扫到 box 声明的长度和实际缓冲区长度中较小的那个；size=0 表示到文件末尾，size=1（64 位长度）不扫 compatible。
 */
function isAvifFtyp(b, at) {
  const avif = (i) => at(i, 0x61, 0x76, 0x69, 0x66) || at(i, 0x61, 0x76, 0x69, 0x73);
  if (avif(8)) return true;
  const len = b.length >>> 0;
  const size = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  if (size === 1) return false;
  const end = Math.min(size === 0 ? len : size, len);
  for (let i = 16; i + 4 <= end; i += 4) if (avif(i)) return true;
  return false;
}

/** 把文件名的扩展名换成 ext（没有扩展名就补上） */
export function withExt(filename, ext) {
  if (!ext) return filename;
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${stem}.${ext}`;
}

/**
 * 图片下载只允许 *.zhimg.com（代码层限制；manifest 1.1.10 起声明 https://*.zhimg.com/* 主机权限，安装时一次授予）。
 * 审查 P3（release-polish-2 ②）：以 https://www.zhihu.com 为 base 解析（兼容 // 开头），
 * 主机名去掉末尾的点再比较；zhimg 的 http 地址升级成 https。不在白名单返回 null。
 */
export function normalizeImageUrl(url) {
  if (url == null || url === '') return null;
  try {
    const u = new URL(String(url), 'https://www.zhihu.com');
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.toLowerCase().replace(/\.+$/, '');
    if (!(host === 'zhimg.com' || host.endsWith('.zhimg.com'))) return null;
    u.protocol = 'https:';
    u.hostname = host;
    return u.href;
  } catch {
    return null;
  }
}

export function isAllowedImageUrl(url) {
  return normalizeImageUrl(url) !== null;
}

/**
 * QA P2Z-01：写进 Markdown 的在线图片地址。协议相对的 `//host/...` 补成 `https://host/...`
 * （本地打开 .md 时 `//` 会被解析成 file://）；http 的 zhimg 图升成 https（见 upgradeZhimgHttp）；
 * 其他地址（https、非 zhimg 的 http、images/ 本地路径等）原样返回。
 */
export function markdownImageUrl(url) {
  const s = String(url ?? '');
  if (s.startsWith('//')) return `https:${s}`;
  return upgradeZhimgHttp(s);
}

/**
 * 主管决定（P2Z 追加）：http 的知乎图床（zhimg.com 及其子域）在 Markdown 里写成 https，其他域名的 http 绝对地址不动。
 * 协议和主机名不分大小写；只处理默认端口（不写或 :80，升级后去掉 :80），其他端口、带用户信息的地址不动。
 */
function upgradeZhimgHttp(s) {
  if (!/^http:\/\//i.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { return s; }
  const host = u.hostname.toLowerCase();
  if (!(host === 'zhimg.com' || host.endsWith('.zhimg.com'))) return s;
  if (u.username || u.password || (u.port && u.port !== '80')) return s;
  // 只换协议（和可能的 :80），路径、查询串保持原样
  return s.replace(/^http:\/\/([^/?#]+)/i, (_, auth) => `https://${auth.replace(/:80$/, '')}`);
}

// 第三轮 B（设计定稿）：图片提示文案集中在这里。failed = 真正的下载失败；kept = 按白名单或格式规则保留在线链接
export function imageFailText(n) {
  return `${n} 张图片未能下载，已保留在线链接`;
}
// QA e2fa5da P4：原因单独成句，不用逗号接在数量后面；不说「这些」，1 张和多张都读得通
export const IMAGE_KEPT_REASON = '图片格式或来源不支持保存到本地';
export const IMAGE_KEPT_REASON_SEP = '。';
export function imageKeptText(m) {
  return `${m} 张图片保留为在线链接`;
}
export function imageKeptMoreText(m) {
  return `另有 ${m} 张图片保留为在线链接`;
}
/** 悬浮球读屏补充（两者都有时） */
export function imageKeptMoreShortText(m) {
  return `另有 ${m} 张保留为在线链接`;
}
/** PM 定稿 2026-10-29：f>0 且 k>0 时的合并句（failed = 白名单内下载出错；kept = 不在白名单或格式认不出；两者不重叠） */
export function imageFailedKeptText(failed, kept) {
  return `${failed} 张图片未能下载，${kept} 张不支持保存，均已保留在线链接`;
}
/** ZR-02 部分导出琥珀提示里的次级行；没有图片问题返回空串 */
export function imagePartialLine(failed, kept) {
  if (failed > 0 && kept > 0) return imageFailedKeptText(failed, kept);
  if (failed > 0) return imageFailText(failed);
  if (kept > 0) return imageKeptText(kept);
  return '';
}
/**
 * QA P2Z-02：悬浮球「部分导出」时读屏（aria-label / live region）末尾补的图片信息，和弹窗琥珀提示的次级行同一套文案；
 * 只有保留时和成功态一样带上原因。没有图片问题返回空串。
 */
export function imagePartialSrExtra(failed, kept) {
  // P2Z-B（设计决定）：和悬浮球成功态同一说法——失败句完整说「已保留在线链接」，保留数接在后面
  if (failed > 0 && kept > 0) return imageFailedKeptText(failed, kept);
  if (failed > 0) return imageFailText(failed);
  if (kept > 0) return `${imageKeptText(kept)}${IMAGE_KEPT_REASON_SEP}${IMAGE_KEPT_REASON}`;
  return '';
}
/** P2Z-B：读屏里导出概况和图片情况之间的分隔符 */
export const PARTIAL_SR_SEP = '；';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} content Markdown，图片写成 ](images/<filename>)
 * @param {Array<{url, filename}>} images
 * @param {Array<{ok: boolean, data?: Uint8Array, contentType?: string}>} results 与 images 一一对应
 * @returns {{content: string, files: Array<{filename, data}>, failed: number, kept: number}}
 * results[i].kept = true 表示按白名单规则没去下载（计入 kept，不算失败）
 */
export function applyImageResults(content, images, results) {
  let out = content;
  const files = [];
  let failed = 0;
  let kept = 0;
  images.forEach((img, i) => {
    const r = results[i] || { ok: false };
    const link = new RegExp(`\\]\\(images/${escapeRe(img.filename)}\\)`, 'g');
    // 复审 51f7f33 P3：只认文件头魔数；认不出时不信 Content-Type（200 + HTML 错误页标成 image/jpeg 会被写成坏图）→ kept
    const ext = r.ok ? extFromMagic(r.data) : null;
    if (!ext) {
      // ok 但格式认不出（SVG、ico 等）或被白名单拦下 → kept；网络/状态码/重定向失败 → failed
      if (r.ok || r.kept) kept += 1; else failed += 1;
      out = out.replace(link, () => `](${markdownImageUrl(img.url)})`); // QA P2Z-01：// 开头补 https:
      return;
    }
    const filename = withExt(img.filename, ext);
    if (filename !== img.filename) out = out.replace(link, () => `](images/${filename})`);
    files.push({ filename, data: r.data });
  });
  return { content: out, files, failed, kept };
}
