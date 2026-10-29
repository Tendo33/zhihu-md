/**
 * 悬浮球的组合文案（图片读屏补充、失败原因），按界面语言取 _locales。
 * 中文与 lib/image-pack.js、lib/failure-reason.js 的弹窗文案一致；弹窗本身不在这里改（ZR-05 范围）。
 */
import { t, tn } from './i18n.js';
import { describeFailure } from '../../lib/failure-text.js';

const FAIL_KEY = {
  security_check: 'failSecurityCheck',
  login_required: 'failLoginRequired',
  not_loaded: 'failNotLoaded',
  clipboard: 'failClipboard',
};

/** 部分导出时读屏末尾的图片信息（对应 imagePartialSrExtra）；没有图片问题返回空串 */
export function ballImageSrExtra(failed, kept) {
  if (failed > 0 && kept > 0) return tn('ballImagesFailed', failed) + t('ballSep') + t('ballImagesKeptMore', kept);
  if (failed > 0) return tn('ballImagesFailed', failed);
  if (kept > 0) return tn('ballImagesKept', kept) + t('ballSep') + t('ballImagesKeptReason');
  return '';
}

/** 成功态读屏补充：只算保留的图片（失败数已在 tooltip 里） */
export function ballKeptSrExtra(failed, kept) {
  if (!(kept > 0)) return '';
  return failed > 0 ? t('ballImagesKeptMore', kept) : tn('ballImagesKept', kept) + t('ballSep') + t('ballImagesKeptReason');
}

/** 失败原因：沿用 describeFailure 的判定，文字按界面语言取 */
export function ballFailureText(error, action = 'export') {
  const { reason } = describeFailure(error, action);
  if (FAIL_KEY[reason]) return t(FAIL_KEY[reason]);
  return t(action === 'copy' ? 'failCopyUnknown' : 'failExportUnknown');
}
