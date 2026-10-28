// 从整页抓取的知乎 HTML 里裁出正文片段，作为可提交的测试 fixture。
// 用法：node scripts/crop-fixtures.js <整页 fixtures 目录>
// 只保留正文节点；去掉脚本/样式/图标/交互按钮；属性只留转换需要的白名单。
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/crop-fixtures.js <full-page fixtures dir>');
const OUT = path.resolve('tests/fixtures');

const KEEP_ATTRS = new Set([
  'class', 'name', 'href', 'src', 'alt', 'title', 'data-tex', 'data-original', 'data-actualsrc',
  'data-default-watermark-src', 'data-draft-type', 'data-text', 'colspan', 'rowspan', 'lang',
  'data-numerator', 'data-tag',
]);
const DROP = 'script, style, noscript, svg, button, iframe, link, meta, .ContentItem-actions, .AuthorInfo, '
  + '.ContentItem-meta, .Reward, .RichContent-actions, .Comments-container, .Voters, .AppHeader, '
  + '.Popover, .HotItem-img, .HotItem-action';

function clean(root) {
  root.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (!KEEP_ATTRS.has(attr.name)) el.removeAttribute(attr.name);
    }
    // 站内链接去掉追踪参数
    for (const a of ['href', 'src', 'data-original', 'data-actualsrc']) {
      const v = el.getAttribute(a);
      if (v && /^https?:\/\/link\.zhihu\.com\/\?target=/.test(v)) continue;
      // 第三方用户主页（正文里的 @提及）换成占位，不在仓库里留真实用户 ID
      if (v && /(^|\/\/)(www\.)?zhihu\.com\/people\/|^\/people\//.test(v)) {
        el.setAttribute(a, 'https://www.zhihu.com/people/placeholder');
        continue;
      }
      if (v && /[?&](utm_|source=|share_code)/.test(v)) el.setAttribute(a, v.split('?')[0]);
    }
  }
  return root;
}

// 超长正文按顶层块截断到 budget 字节以内，保持文件小
function trimBlocks(rich, budget) {
  let size = 0;
  for (const child of [...rich.children]) {
    size += child.outerHTML.length;
    if (size > budget) child.remove();
  }
}

function load(file) {
  return parseHTML(fs.readFileSync(path.join(SRC, file), 'utf8')).document;
}

function answerFragment(doc, id, budget) {
  const item = doc.querySelector(`.AnswerItem[name="${id}"]`);
  if (!item) throw new Error('answer not found: ' + id);
  const rich = clean(item.querySelector('.RichText').cloneNode(true));
  if (budget) trimBlocks(rich, budget);
  return `<div class="AnswerItem" name="${id}"><div class="RichContent"><div class="RichContent-inner">${rich.outerHTML}</div></div></div>`;
}

function write(name, sourceUrl, body) {
  const html = `<!doctype html>\n<!-- source: ${sourceUrl} ; cropped by scripts/crop-fixtures.js ; 知乎第三方内容裁剪片段，仅用于转换测试 -->\n<html><head><meta charset="utf-8"></head><body>\n${body}\n</body></html>\n`;
  fs.writeFileSync(path.join(OUT, name), html);
  console.log(name, html.length);
}

let d = load('answer-latex.html');
write('answer-latex.html', 'https://www.zhihu.com/question/398038164/answer/1260166810', answerFragment(d, '1260166810', 30000));

d = load('answer-code.html');
write('answer-code.html', 'https://www.zhihu.com/question/282627359/answer/3278589663', answerFragment(d, '3278589663', 30000));

d = load('answer-long.html');
write('answer-long.html', 'https://www.zhihu.com/question/282627359/answer/2571795386', answerFragment(d, '2571795386', 60000));

d = load('article-tables.html');
const post = clean(d.querySelector('.Post-RichText').cloneNode(true));
const title = d.querySelector('.Post-Title')?.textContent.trim() || '';
write('article-tables.html', 'https://zhuanlan.zhihu.com/p/2045164250952467157',
  `<h1 class="Post-Title">${title}</h1><div class="Post-RichTextContainer">${post.outerHTML}</div>`);

d = load('question-multi.html');
const qTitle = d.querySelector('.QuestionHeader-title')?.textContent.trim() || '';
const ids = ['1334631491', '1261862523', '1266832607'];
write('question-multi.html', 'https://www.zhihu.com/question/398038164',
  `<h1 class="QuestionHeader-title">${qTitle}</h1><div class="List">${ids.map((id) => answerFragment(d, id)).join('\n')}</div>`);

d = load('hot.html');
const list = d.querySelector('.HotList-list');
[...list.querySelectorAll('.HotItem')].slice(10).forEach((el) => el.remove());
list.querySelectorAll('.HotItem-excerpt').forEach((el) => el.remove());
write('hot.html', 'https://www.zhihu.com/hot', clean(list.cloneNode(true)).outerHTML);
