# Manifest.json 更新说明

由于 `.cursorignore` 限制，请手动更新 `manifest.json` 文件。

## 需要修改的内容

将 `content_scripts` 部分的 `js` 数组替换为以下内容：

```json
{
  "manifest_version": 3,
  "name": "Zhihu to Markdown",
  "version": "1.0.7",
  "description": "将知乎专栏/问答页面内容转换为 Markdown 格式并下载",
  "permissions": [
    "activeTab",
    "downloads",
    "storage"
  ],
  "host_permissions": [
    "*://*.zhihu.com/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*.zhihu.com/*"],
      "js": [
        "lib/turndown.min.js",
        "lib/logger.js",
        "content/modules/constants.js",
        "content/modules/detector.js",
        "content/modules/turndown-rules.js",
        "content/modules/exporters/article.js",
        "content/modules/exporters/question.js",
        "content/modules/exporters/feed.js",
        "content/modules/exporters/hot.js",
        "content/modules/floating-ball.js",
        "content/content.js"
      ],
      "css": [
        "content/content.css"
      ],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## 关键变更

1. **版本号**: 从 `1.0.6` 更新到 `1.0.7`

2. **新增的 JS 模块**（按加载顺序）:
   - `content/modules/constants.js` - 常量和工具函数
   - `content/modules/detector.js` - 页面类型检测
   - `content/modules/turndown-rules.js` - Markdown 转换规则
   - `content/modules/exporters/article.js` - 单篇文章导出
   - `content/modules/exporters/question.js` - 问题页多回答导出
   - `content/modules/exporters/feed.js` - 首页/关注页导出
   - `content/modules/exporters/hot.js` - 热榜导出
   - `content/modules/floating-ball.js` - 悬浮球组件

## 更新后请重新加载扩展

1. 打开 `chrome://extensions/`
2. 找到 "Zhihu to Markdown" 扩展
3. 点击刷新按钮或重新加载
