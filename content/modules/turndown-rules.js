/**
 * Turndown Rules Module
 * Custom Turndown rules for converting Zhihu HTML to Markdown
 */

/**
 * Configure Turndown with custom rules for Zhihu.
 * When downloadImages is true, collected image metadata is available via
 * turndownService.imageCollector.images after conversion.
 * @param {boolean} downloadImages - Whether to use local image paths
 * @returns {TurndownService}
 */
function createTurndownService(downloadImages = false) {
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

  // Rule: Math formulas - extract LaTeX from data-tex attribute
  turndownService.addRule('zhihuMath', {
    filter: function(node) {
      return node.classList && node.classList.contains('ztext-math');
    },
    replacement: function(content, node) {
      const tex = node.getAttribute('data-tex') || content;
      const isBlock = node.parentElement?.classList?.contains('ztext-math-container') ||
                      node.closest('.ztext-math-container');
      if (isBlock) {
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
      
      if (!src) return '';
      
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
      const title = node.querySelector('.LinkCard-title')?.textContent ||
                    link.textContent?.trim() ||
                    '链接';
      
      let cleanHref = href;
      if (href.includes('link.zhihu.com')) {
        try {
          const url = new URL(href);
          cleanHref = url.searchParams.get('target') || href;
        } catch {}
      }
      
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
      return node.classList && node.classList.contains('VideoCard');
    },
    replacement: function(content, node) {
      const link = node.querySelector('a');
      const href = link?.getAttribute('href') || '';
      return `[视频](${href})`;
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
        let text = turndownService.turndown(html);
        text = text.replace(/\|/g, '\\|');
        text = text.replace(/\n/g, '<br>');
        return text.trim();
      };

      const rows = Array.from(node.rows);
      if (rows.length === 0) return '';

      let markdown = '\n\n';

      const headerRow = rows[0];
      const headers = Array.from(headerRow.cells).map(convertCell);
      markdown += '| ' + headers.join(' | ') + ' |\n';
      markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.cells);
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

  return turndownService;
}

// Export
if (typeof window !== 'undefined') {
  window.createTurndownService = createTurndownService;
}
