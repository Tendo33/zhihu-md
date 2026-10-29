// build.js 和 verify-dist.js 共用的 --target 解析（审查 bg-scripts P2）。
// 接受 --target=firefox 和 --target firefox；不写时默认 chrome。
// 写了 --target 却取不到合法值（空值、缺值、未知值、重复）时返回 error，调用方报错退出，不再静默按 Chrome 处理。
export const TARGETS = ['chrome', 'firefox'];

export function parseTargetArgs(argv) {
  const rest = [];
  const seen = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: '--target 后面缺少取值，只支持 chrome / firefox' };
      seen.push(v); i++;
    } else if (a.startsWith('--target=')) {
      seen.push(a.slice('--target='.length));
    } else {
      rest.push(a);
    }
  }
  if (seen.length > 1) return { error: `--target 写了 ${seen.length} 次（${seen.join(', ')}），只能写一次` };
  if (!seen.length) return { target: 'chrome', rest };
  const target = seen[0].trim().toLowerCase();
  if (!target) return { error: '--target 的值为空，只支持 chrome / firefox' };
  if (!TARGETS.includes(target)) return { error: `未知的 --target 值「${seen[0]}」，只支持 chrome / firefox` };
  return { target, rest };
}
