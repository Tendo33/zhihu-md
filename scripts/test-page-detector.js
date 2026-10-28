import { detectPageTypeFromPathname as detect, checkUrlType as check } from '../lib/page-detector.js';

const cases = [
  ['/p/abc/', 'column'], ['/p/abc//', 'column'], ['/question/123', 'question'],
  ['/question/123/answer/456/', 'answer'], ['/hot/', 'hot'], ['/follow', 'follow'], ['/', 'home']
];
for (const [path, expected] of cases) {
  if (detect(path) !== expected) throw new Error(`${path} classification mismatch`);
}
if (check('https://evilzhihu.com/p/x').isZhihu) throw new Error('lookalike host accepted');
if (!check('https://www.zhihu.com/question/123?utm=1').isQuestion) throw new Error('query URL rejected');
if (!check('https://www.zhihu.com/question/123/answer/456?utm=1').isAnswer) throw new Error('answer query URL rejected');
if (check('https://www.zhihu.com.evil.example/question/123').isZhihu) throw new Error('suffix lookalike host accepted');
if (detect('/question/123/log') !== null) throw new Error('question subpath accepted');
if (detect('/question/123/answer/abc') !== null) throw new Error('non-numeric answer accepted');
if (check('https://www.zhihu.com/question/123/log').isQuestion) throw new Error('popup accepted question subpath');
console.log(`page detector: ${cases.length + 2} assertions passed`);

{
  const { hasExportableContent } = await import('../lib/page-detector.js');
  const fakeRoot = (selectors) => ({ querySelector: (sel) => (sel.split(',').some((s) => selectors.includes(s.trim())) ? {} : null) });
  if (!hasExportableContent(fakeRoot(['.Post-RichText']), 'column')) throw new Error('column content not detected');
  if (hasExportableContent(fakeRoot(['.ErrorPage']), 'column')) throw new Error('error page treated as content');
  if (hasExportableContent(fakeRoot(['.AnswerItem']), null)) throw new Error('unknown page type treated as content');
  if (!hasExportableContent(fakeRoot(['.HotItem']), 'hot')) throw new Error('hot list not detected');
  console.log('page detector: content presence assertions passed');
}
