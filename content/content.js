/**
 * Content script entry point for Zhihu-md extension
 * Orchestrates modules and handles message routing
 */

(function() {
  'use strict';

  // ============== Logger System ==============
  const Logger = createLogger('[Zhihu-MD Content]');

  Logger.info('==========================================');
  Logger.info('Content script 开始加载...');
  Logger.info('当前URL:', window.location.href);
  Logger.info('==========================================');

  // Prevent multiple injections
  if (window.__zhihuMdInjected) {
    Logger.warn('脚本已经注入过，跳过重复注入');
    return;
  }
  window.__zhihuMdInjected = true;

  // Check TurndownService
  if (typeof TurndownService === 'undefined') {
    Logger.error('TurndownService 未加载！');
  } else {
    Logger.success('TurndownService 已加载');
  }

  // Check modules
  const requiredModules = ['PageDetector', 'CONSTANTS', 'createTurndownService', 'ArticleExporter', 'QuestionExporter', 'FeedExporter', 'HotExporter', 'FloatingBall'];
  const missingModules = requiredModules.filter(m => typeof window[m] === 'undefined');
  
  if (missingModules.length > 0) {
    Logger.error('缺少模块:', missingModules.join(', '));
      } else {
    Logger.success('所有模块已加载');
  }

  // ============== Message Handler ==============
  Logger.info('注册消息监听器...');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    Logger.info('收到消息:', message);
    
    if (message.action === 'getArticleInfo') {
      const result = ArticleExporter.getArticleInfo();
      Logger.info('返回文章信息:', result);
      sendResponse(result);
    } else if (message.action === 'exportMarkdown') {
      const result = ArticleExporter.exportMarkdown();
      Logger.info('返回导出结果:', result.success ? '成功' : '失败');
      sendResponse(result);
    } else if (message.action === 'routeChanged') {
      Logger.info('路由改变，重新检查悬浮球状态...');
      setTimeout(() => FloatingBall.init(), 1000);
    } else {
      Logger.warn('未知的消息类型:', message.action);
    }
    
    return true;
  });
  
  Logger.success('消息监听器注册成功!');

  // ============== Storage Change Handler ==============
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

  // ============== DOM Observer ==============
  const observer = new MutationObserver((mutations) => {
    if (PageDetector.isValidArticlePage() && !document.getElementById('zhihu-md-floating-ball')) {
      if (window._initTimeout) clearTimeout(window._initTimeout);
      window._initTimeout = setTimeout(() => FloatingBall.init(), 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ============== Initialize ==============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FloatingBall.init());
  } else {
    setTimeout(() => FloatingBall.init(), 500);
  }

  Logger.info('Content script 初始化完成!');
})();
