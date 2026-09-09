const fs = require('fs');
const vm = require('vm');
const context = { window: {}, URL };
vm.runInNewContext(fs.readFileSync('lib/page-detector.js', 'utf8'), context);
const { detectPageTypeFromPathname: detect, checkUrlType: check } = context.window.PageTypeUtils;
const cases = [
  ['/p/abc/', 'column'], ['/p/abc//', 'column'], ['/question/123', 'question'],
  ['/question/123/answer/456/', 'answer'], ['/hot/', 'hot'], ['/follow', 'follow'], ['/', 'home']
];
for (const [path, expected] of cases) if (detect(path) !== expected) throw new Error(`${path} classification mismatch`);
if (check('https://evilzhihu.com/p/x').isZhihu) throw new Error('lookalike host accepted');
if (!check('https://www.zhihu.com/question/123?utm=1').isQuestion) throw new Error('query URL rejected');
if (!check('https://www.zhihu.com/question/123/answer/456?utm=1').isAnswer) throw new Error('answer query URL rejected');
if (check('https://www.zhihu.com.evil.example/question/123').isZhihu) throw new Error('suffix lookalike host accepted');
console.log(`page detector: ${cases.length + 2} assertions passed`);
