import { createLogger } from '../lib/logger.js';
import { capAnswerCount, normalizeAnswerCount } from '../lib/answer-limit.js';
import { DEFAULT_IMAGE_DIR, normalizeImageDir } from '../lib/image-pack.js';

const Logger = createLogger('[Zhihu-MD Options]');

// 图片文件夹名不允许使用时的提示，key 与 lib/image-pack.js 的 error 一一对应
const IMAGE_DIR_ERRORS = {
  empty: '不能为空',
  too_long: '最多 32 个字符',
  charset: '只能用文字、数字、下划线、短横线和点',
  dots: '不能以点开头或结尾',
  reserved: '是系统保留名，请换一个'
};
const imageDirNote = (error) => (error ? `不允许使用：${IMAGE_DIR_ERRORS[error]}` : '');

// 每个提示元素各用一套定时器：同一帧里更新两个提示时不能互相取消
const noteTimers = new WeakMap();

function cancelNote(note) {
  const pending = noteTimers.get(note);
  if (!pending) return;
  clearTimeout(pending.timer);
  if (pending.frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pending.frame);
  noteTimers.delete(note);
}

/**
 * 设计复核 S6：同一条提示连续出现时读屏也要再播报。
 * 先清空，下一帧再写入，live region 才会认为内容变了。
 */
export function announceNote(note, text) {
  note.textContent = '';
  cancelNote(note);
  if (!text) return;
  const write = () => { note.textContent = text; noteTimers.delete(note); };
  if (typeof requestAnimationFrame === 'function') noteTimers.set(note, { frame: requestAnimationFrame(write) });
  else noteTimers.set(note, { timer: setTimeout(write, 16) });
}

function saveOptions() {
  const showFloatingBall = document.getElementById('showFloatingBall').checked;
  const { value: validCount, note: countNote } = normalizeAnswerCount(document.getElementById('maxAnswerCount').value);
  const downloadImages = document.getElementById('downloadImages').checked;
  const dirInput = document.getElementById('imageDir');
  const imageDir = normalizeImageDir(dirInput ? dirInput.value : DEFAULT_IMAGE_DIR);

  document.getElementById('maxAnswerCount').value = validCount;
  // 和条数一样把规范化的值写回输入框；非法时保留原文，方便继续改
  if (dirInput && !imageDir.error) dirInput.value = imageDir.dir;

  chrome.storage.sync.set({
    showFloatingBall: showFloatingBall,
    maxAnswerCount: validCount,
    downloadImages: downloadImages,
    // 非法名字不写入，改对后再保存；旧值继续生效
    ...(imageDir.error ? {} : { imageDir: imageDir.dir })
  }, () => {
    Logger.info('设置已保存:', { showFloatingBall, maxAnswerCount: validCount, downloadImages, imageDir: imageDir.dir });
    // 设计 M3：页脚左侧「✓ 已保存」，2.5 秒后淡出；被上限或下限改值时在数字框下方留一行警示，保留到下次修改
    const note = document.getElementById('note-maxAnswerCount');
    if (note) announceNote(note, countNote);
    // 图片文件夹名非法时在输入框下方提示，状态栏不报「已保存」，避免误以为存进去了
    const dirNote = document.getElementById('note-imageDir');
    if (dirNote) announceNote(dirNote, imageDirNote(imageDir.error));
    const status = document.getElementById('status');
    status.textContent = imageDir.error ? '图片文件夹名未保存' : '✓ 已保存';
    status.classList.add('show');
    clearTimeout(saveOptions.hideTimer);
    saveOptions.hideTimer = setTimeout(() => {
      status.classList.remove('show');
    }, 2500);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    showFloatingBall: true,
    maxAnswerCount: 20,
    downloadImages: false,
    imageDir: DEFAULT_IMAGE_DIR
  }, (items) => {
    Logger.info('已读取设置:', items);
    document.getElementById('showFloatingBall').checked = items.showFloatingBall;
    document.getElementById('maxAnswerCount').value = capAnswerCount(items.maxAnswerCount);
    document.getElementById('downloadImages').checked = items.downloadImages;
    const dirInput = document.getElementById('imageDir');
    if (dirInput) dirInput.value = normalizeImageDir(items.imageDir).dir;
  });
}

// 输入时先提示，失焦（change）再保存；非法值不会写进 storage
function validateImageDir() {
  const input = document.getElementById('imageDir');
  const note = document.getElementById('note-imageDir');
  if (!input || !note) return;
  announceNote(note, imageDirNote(normalizeImageDir(input.value).error));
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('showFloatingBall').addEventListener('change', saveOptions);
document.getElementById('maxAnswerCount').addEventListener('change', saveOptions);
document.getElementById('downloadImages').addEventListener('change', saveOptions);
const imageDirInput = document.getElementById('imageDir');
if (imageDirInput) {
  imageDirInput.addEventListener('input', validateImageDir);
  imageDirInput.addEventListener('change', saveOptions);
}


// Z11：版本号从 manifest 读取，不再写死
try {
  const versionEl = document.getElementById('app-version');
  if (versionEl && typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  }
} catch { /* 非扩展环境忽略 */ }
