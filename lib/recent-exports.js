/**
 * Round 3 C-2：popup「最近导出」记录（storage.local，最多 20 条，popup 显示 3 条）。
 * 只存标题、成功与否、时间戳，不存正文。
 */
export const RECENT_KEY = 'recentExports';
export const RECENT_MAX = 20;

export function addRecent(list, entry, now = Date.now()) {
  const next = [{ title: String(entry.title || '').slice(0, 200), ok: !!entry.ok, ts: entry.ts || now }, ...(Array.isArray(list) ? list : [])];
  return next.slice(0, RECENT_MAX);
}

export async function recordRecent(storage, entry) {
  if (!storage || !storage.local) return;
  const got = await storage.local.get({ [RECENT_KEY]: [] });
  await storage.local.set({ [RECENT_KEY]: addRecent(got[RECENT_KEY], entry) });
}

/** 样稿里的相对时间：刚刚 / n 分钟前 / n 小时前 / 昨天 / n 天前 */
export function relativeTime(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  if (ts >= d0.getTime()) return `${h} 小时前`;
  if (ts >= d0.getTime() - 86400000) return '昨天';
  return `${Math.ceil((d0.getTime() - ts) / 86400000)} 天前`;
}

export function titleFromFilename(name) {
  return String(name || '').replace(/^.*[\\/]/, '').replace(/(_with_images)?\.(md|zip)$/i, '');
}
