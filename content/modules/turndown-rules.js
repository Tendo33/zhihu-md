/**
 * Turndown Rules Module
 * Custom Turndown rules for converting Zhihu HTML to Markdown
 */

import TurndownService from '../../lib/turndown.min.js';

/**
 * Configure Turndown with custom rules for Zhihu.
 * When downloadImages is true, collected image metadata is available via
 * turndownService.imageCollector.images after conversion.
 * @param {boolean} downloadImages - Whether to use local image paths
 * @returns {TurndownService}
 */
export function normalizeZhihuHref(href = '') {
  let value = String(href).trim();
  if (value.startsWith('//')) value = 'https:' + value;
  else if (value.startsWith('/')) value = 'https://www.zhihu.com' + value;
  if (/^https?:\/\/link\.zhihu\.com\//.test(value)) {
    try {
      value = new URL(value).searchParams.get('target') || value;
    } catch { /* 不是合法 URL 时保留原值 */ }
  }
  return value;
}

// 代码块外：去掉只含空白的行（连续 <br> 产生），压缩多余空行；代码块原样保留
export function tidyMarkdown(markdown) {
  return markdown.split(/(^```[^\n]*\n[\s\S]*?^```$)/m).map((part, i) => (i % 2
    ? part
    : part.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n'))).join('');
}

export function createTurndownService(downloadImages = false) {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });

  // Attach a per-instance image collector when download mode is enabled
  const collector = downloadImages
    ? { images: [], addImage(url, filename) { this.images.push({ url, filename }); return `images/${filename}`; } }
    : null;
  turndownService.imageCollector = collector;

  // Rule: Math formulas - extract LaTeX from data-tex attribute.
  // Display math used to live in .ztext-math-container. It is now a paragraph
  // whose only child is the formula.
  turndownService.addRule('zhihuMath', {
    filter: function(node) {
      return node.nodeType === 1 && node.hasAttribute('data-tex') &&
        (node.classList.contains('ztext-math') || node.children.length === 0);
    },
    replacement: function(content, node) {
      const tex = node.getAttribute('data-tex') || content;
      if (isDisplayMath(node)) {
        return `\n\n$$${tex}$$\n\n`;
      }
      return `$${tex}$`;
    }
  });

  // Rule: High-resolution images (with optional download support)
  turndownService.addRule('zhihuImage', {
    filter: 'img',
    replacement: function(content, node) {
      const src = node.getAttribute('data-original') ||
                  node.getAttribute('data-actualsrc') ||
                  node.getAttribute('data-src') ||
                  node.getAttribute('src');
      
      if (!src || src.startsWith('data:')) return '';
      
      const alt = node.getAttribute('alt') || '图片';
      let cleanSrc = src;
      if (cleanSrc.includes('zhimg.com')) {
        cleanSrc = cleanSrc.replace(/_\w+\./, '.');
      }
      
      // If download mode is enabled, collect image and use local path
      if (downloadImages && collector) {
        const urlParts = cleanSrc.split('/');
        let filename = urlParts[urlParts.length - 1].split('?')[0];
        const ext = filename.includes('.') ? '' : '.jpg';
        const index = collector.images.length + 1;
        filename = `img_${index.toString().padStart(3, '0')}_${filename}${ext}`;
        const localPath = collector.addImage(cleanSrc, filename);
        return `![${alt}](${localPath})`;
      }
      
      return `![${alt}](${cleanSrc})`;
    }
  });

  // Rule: Code blocks with language detection
  turndownService.addRule('zhihuCodeBlock', {
    filter: function(node) {
      return node.nodeName === 'PRE' || 
             (node.nodeName === 'DIV' && node.classList.contains('highlight'));
    },
    replacement: function(content, node) {
      let language = '';

      const codeElement = node.querySelector('code') || node;
      
      const classes = Array.from(codeElement.classList || []);
      for (const cls of classes) {
        if (cls.startsWith('language-')) {
          language = cls.replace('language-', '');
          break;
        }
        if (cls.startsWith('lang-')) {
          language = cls.replace('lang-', '');
          break;
        }
      }

      const code = codeElement.textContent || '';
      
      return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
    }
  });

  // Rule: Link cards - convert to simple links
  turndownService.addRule('zhihuLinkCard', {
    filter: function(node) {
      return node.classList && 
             (node.classList.contains('LinkCard') || 
              node.classList.contains('RichText-LinkCardContainer'));
    },
    replacement: function(content, node) {
      const link = node.querySelector('a');
      if (!link) return '';
      
      const href = link.getAttribute('href') || '';
      const title = linkCardTitle(node, link);
      
      const cleanHref = normalizeZhihuHref(href);

      return `[${title}](${cleanHref})`;
    }
  });

  // Rule: Blockquotes
  turndownService.addRule('zhihuBlockquote', {
    filter: 'blockquote',
    replacement: function(content) {
      const lines = content.trim().split('\n');
      return '\n\n' + lines.map(line => `> ${line}`).join('\n') + '\n\n';
    }
  });

  // Rule: Video placeholders
  turndownService.addRule('zhihuVideo', {
    filter: function(node) {
      return node.nodeName === 'VIDEO' || (node.classList && node.classList.contains('VideoCard'));
    },
    replacement: function(content, node) {
      if (node.nodeName === 'VIDEO') {
        const src = node.getAttribute('src') || node.querySelector('source')?.getAttribute('src') || '';
        return src ? `\n\n[视频](${src})\n\n` : '';
      }
      const link = node.querySelector('a');
      const href = link?.getAttribute('href') || '';
      return href ? `[视频](${href})` : '';
    }
  });

  // Rule: Tables
  turndownService.addRule('zhihuTable', {
    filter: 'table',
    replacement: function (content, node) {
      const convertCell = (cell) => {
        const html = cell.innerHTML || '';
        if (html.includes('<table')) {
          return '[Nested Table]';
        }
        let text = turndownService.turndown(cell);
        text = text.replace(/\|/g, '\\|');
        text = text.replace(/\n/g, '<br>');
        return text.trim();
      };

      const rows = Array.from(node.rows || node.querySelectorAll('tr'));
      if (rows.length === 0) return '';

      let markdown = '\n\n';

      const headerRow = rows[0];
      const headerCells = headerRow.cells || headerRow.querySelectorAll('th, td');
      const headers = Array.from(headerCells).map(convertCell);
      markdown += '| ' + headers.join(' | ') + ' |\n';
      markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.cells || row.querySelectorAll('th, td'));
        const rowData = headers.map((_, index) => {
          const cell = cells[index];
          return cell ? convertCell(cell) : '';
        });
        markdown += '| ' + rowData.join(' | ') + ' |\n';
      }

      return markdown + '\n';
    }
  });

  // Rule: Basic Formatting
  turndownService.addRule('zhihuFormat', {
    filter: ['b', 'strong', 'i', 'em', 'u', 's', 'del'],
    replacement: function (content, node) {
      const tag = node.nodeName.toLowerCase();
      if (!content.trim()) return content;
      // 标题本身已是粗体，去掉多余的 ** 包裹
      if ((tag === 'b' || tag === 'strong') && node.closest?.('h1, h2, h3, h4, h5, h6')) return content;
      if (tag === 'b' || tag === 'strong') return `**${content}**`;
      if (tag === 'i' || tag === 'em') return `*${content}*`;
      if (tag === 'u') return `<u>${content}</u>`;
      if (tag === 's' || tag === 'del') return `~~${content}~~`;
      return content;
    }
  });

  // Rule: Line Breaks
  turndownService.addRule('zhihuBr', {
    filter: 'br',
    replacement: function () {
      return '  \n';
    }
  });

  // Rule: Horizontal Rule
  turndownService.addRule('zhihuHr', {
    filter: 'hr',
    replacement: function () {
      return '\n\n---\n\n';
    }
  });

  // 知乎参考脚注：<sup data-draft-type="reference" data-text data-url data-numero>
  // 注意：这套 DOM 结构（属性名、参考列表 class）是按知乎编辑器输出推测的，
  // 目前没有真实样本核对，测试用的是手写 fixture（tests/fixtures/footnote.html）；
  // 拿到带参考脚注的真实回答后要按实际结构校正这里和 zhihuReferenceList。
  // 转成 GFM 脚注 [^n]，定义追加在本次转换结果末尾。编号在同一个 service 内递增，
  // 问题页多个回答共用一个 service 时不会撞号。
  const footnotes = { next: 1, pending: [], seen: new Map() };
  turndownService.addRule('zhihuReference', {
    filter: (node) => node.nodeName === 'SUP' && node.getAttribute('data-draft-type') === 'reference',
    replacement: (content, node) => {
      const text = (node.getAttribute('data-text') || '').trim();
      const url = normalizeZhihuHref(node.getAttribute('data-url') || '');
      if (!text && !url) return content;
      const key = `${text}\u0000${url}`;
      let id = footnotes.seen.get(key);
      if (!id) {
        id = footnotes.next++;
        footnotes.seen.set(key, id);
        footnotes.pending.push(`[^${id}]: ${[text, url].filter(Boolean).join(' ')}`);
      }
      return `[^${id}]`;
    }
  });
  // 页面自带的参考文献列表与脚注定义重复，去掉
  turndownService.addRule('zhihuReferenceList', {
    filter: (node) => /\b(ReferenceList|RichText-references)\b/.test(node.getAttribute?.('class') || ''),
    replacement: () => ''
  });

  // 普通上下标保留为 HTML，避免 x<sup>2</sup> 变成 x2
  turndownService.addRule('zhihuSupSub', {
    filter: (node) => (node.nodeName === 'SUP' || node.nodeName === 'SUB')
      && node.getAttribute('data-draft-type') !== 'reference',
    replacement: (content, node) => {
      const tag = node.nodeName.toLowerCase();
      return content.trim() ? `<${tag}>${content}</${tag}>` : '';
    }
  });
  const turndown = turndownService.turndown.bind(turndownService);
  turndownService.turndown = (input) => {
    footnotes.pending = [];
    footnotes.seen = new Map();
    const markdown = tidyMarkdown(turndown(input));
    if (!footnotes.pending.length) return markdown;
    return `${markdown}\n\n${footnotes.pending.join('\n')}`;
  };

  // 普通链接：解开 link.zhihu.com 跳转，补全协议相对 / 站内相对地址
  turndownService.addRule('zhihuLink', {
    filter: (node) => node.nodeName === 'A' && node.getAttribute('href'),
    replacement: (content, node) => {
      const href = normalizeZhihuHref(node.getAttribute('href'));
      if (!content.trim()) return '';
      const title = node.getAttribute('title');
      return `[${content}](${href}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`;
    }
  });

  // 知乎用 <p class="ztext-empty-paragraph"><br></p> 做空行，直接丢掉，避免输出只有空格的行
  turndownService.addRule('zhihuEmptyParagraph', {
    filter: (node) => node.nodeName === 'P' && /\bztext-empty-paragraph\b/.test(node.getAttribute('class') || ''),
    replacement: () => '\n\n'
  });

  // 段落末尾的 <br> 不产生硬换行（否则会留下行尾两个空格）
  turndownService.addRule('zhihuTrailingBreak', {
    filter: (node) => {
      if (node.nodeName !== 'BR') return false;
      let next = node.nextSibling;
      while (next) {
        if (next.nodeType === 1 || (next.nodeType === 3 && next.textContent.trim())) return false;
        next = next.nextSibling;
      }
      return true;
    },
    replacement: () => ''
  });

  // 标题里不转义有序列表前缀：「## 1. 先记结论」在 ATX 标题里不会被当成列表。
  // turndown 的 escape 对所有文本节点生效，这里只把标题开头的「1\\. 」还原，其余转义（- + 1) 等）不动。
  turndownService.addRule('zhihuHeading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement: (content, node) => {
      const level = Number(node.nodeName.charAt(1));
      const text = content.replace(/^(\s*(?:\*\*|__|[*_])?)(\d+)\\\. /, '$1$2. ');
      return `\n\n${'#'.repeat(level)} ${text}\n\n`;
    }
  });

  return turndownService;
}

function isDisplayMath(node) {
  if (node.parentElement?.classList?.contains('ztext-math-container') || node.closest('.ztext-math-container')) {
    return true;
  }
  const parent = node.parentElement;
  if (!parent || !/^(P|DIV|FIGURE)$/.test(parent.nodeName)) return false;
  for (const child of parent.childNodes) {
    if (child === node) continue;
    if (child.nodeType === 3 && child.textContent.trim()) return false;
    if (child.nodeType === 1) return false;
  }
  return true;
}

function linkCardTitle(node, link) {
  const visible = node.querySelector('.LinkCard-title')?.textContent?.trim();
  if (visible) return visible;
  const candidates = [
    link.getAttribute('data-text'),
    node.querySelector('.LinkCard-title')?.getAttribute('data-text'),
    link.getAttribute('title'),
    link.textContent
  ];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text && text !== 'true') return text;
  }
  return '链接';
}
