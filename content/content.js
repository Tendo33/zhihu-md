/**
 * Content script entry point for Zhihu-md extension.
 */

import { createLogger } from '../lib/logger.js';
import { createInitScheduler } from '../lib/init-scheduler.js';
import { ArticleExporter } from './modules/exporters/article.js';
import { QuestionExporter } from './modules/exporters/question.js';
import { FeedExporter } from './modules/exporters/feed.js';
import { HotExporter } from './modules/exporters/hot.js';
import { FloatingBall } from './modules/floating-ball.js';
import { PageDetector } from './modules/detector.js';

const Logger = createLogger('[Zhihu-MD Content]');

Logger.info('Content script 开始加载...', window.location.href);

if (window.__zhihuMdInjected) {
  Logger.warn('脚本已经注入过，跳过重复注入');
} else {
  window.__zhihuMdInjected = true;

  const scheduleFloatingBallInit = createInitScheduler({
    init: () => FloatingBall.init(),
    minInterval: 800,
    defaultDelay: 500
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    Logger.info('收到消息:', message);

    if (message.action === 'getArticleInfo') {
      sendResponse(ArticleExporter.getArticleInfo());
    } else if (message.action === 'exportMarkdown') {
      const downloadImages = message.downloadImages || false;
      const pageType = PageDetector.detectPageType();

      (async () => {
        let result;
        if (pageType === 'question') {
          result = await QuestionExporter.exportMultipleAnswers();
        } else if (pageType === 'home' || pageType === 'follow') {
          result = await FeedExporter.exportFeedItems(pageType);
        } else if (pageType === 'hot') {
          result = await HotExporter.exportHotList();
        } else {
          result = await ArticleExporter.exportMarkdown(downloadImages);
        }
        Logger.info('返回导出结果:', result.success ? '成功' : '失败');
        sendResponse(result);
      })();
    } else if (message.action === 'routeChanged') {
      Logger.info('路由改变，重新检查悬浮球状态...');
      scheduleFloatingBallInit(800);
    } else {
      Logger.warn('未知的消息类型:', message.action);
    }

    return true;
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.showFloatingBall) {
        if (changes.showFloatingBall.newValue) {
          FloatingBall.init();
        } else {
          FloatingBall.remove();
        }
      }
    });
  }

  // The button is a direct child of document.body. Watching the whole subtree
  // wakes this callback on every feed mutation, which only matters when the
  // button itself has been removed.
  const observer = new MutationObserver(() => {
    if (PageDetector.isValidArticlePage() && !document.getElementById('zhihu-md-floating-ball')) {
      scheduleFloatingBallInit(800);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleFloatingBallInit(500));
  } else {
    scheduleFloatingBallInit(500);
  }

  Logger.info('Content script 初始化完成!');
}
