# Zhihu-md

将知乎专栏/问答/首页/关注/热榜页面内容无损转换为 Markdown 格式并下载的 Chrome 扩展插件。

## ✨ 功能特性

- **多页面类型支持**：
  - 专栏文章 (`/p/xxx`)
  - 问答回答 (`/question/xxx/answer/xxx`)
  - 问题页面多回答导出 (`/question/xxx`)
  - 首页推荐内容 (`/`) - **新功能**: 支持一级标题导出，结构更清晰
  - 关注动态 (`/follow`)
  - 热榜话题 (`/hot`)
- **数学公式还原**：自动提取 LaTeX 公式，转换为标准 `$...$` 和 `$$...$$` 格式
- **高清图片提取**：获取原图链接而非缩略图
- **代码块保留**：保持语法高亮语言标识
- **链接卡片降级**：将知乎特有的链接卡片转为普通 Markdown 链接
- **YAML Front Matter**：自动生成元数据（标题、作者、URL、日期）
- **文件名清洗**：自动处理非法字符，确保下载成功

## 📦 安装方法

1. 下载本仓库代码（或 Clone）
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本项目的根目录

## 🚀 使用方法

### 基础用法
1. 打开任意知乎页面：
   - 专栏文章 (`zhuanlan.zhihu.com/p/...`)
   - 问答页面 (`zhihu.com/question/...`)
   - 首页 (`zhihu.com/`)
   - 关注页 (`zhihu.com/follow`)
   - 热榜页 (`zhihu.com/hot`)
2. 点击浏览器右上角的 Zhihu-md 图标，或使用页面悬浮球
3. 确认信息后点击「导出 Markdown」按钮

### 页面类型说明
- **专栏/回答**：直接导出当前内容
- **问题页面**：自动滚动加载多个回答后导出（默认 20 条）
- **首页/关注页**：自动滚动加载内容后导出（默认 20 条）
- **热榜页**：导出所有热点问题标题和链接


## 📁 项目结构

```
zhihu-md/
├── manifest.json          # Chrome 扩展配置
├── popup/
│   ├── popup.html         # 弹出窗口 UI
│   ├── popup.js           # 弹出窗口逻辑
│   └── popup.css          # 弹出窗口样式
├── content/
│   ├── content.js         # 内容脚本（DOM 解析）
│   └── content.css        # 内容脚本样式（悬浮球）
├── background/
│   └── background.js      # Service Worker
├── options/
│   ├── options.html       # 选项页面 UI
│   ├── options.js         # 选项页面逻辑
│   └── options.css        # 选项页面样式
├── lib/
│   ├── turndown.min.js    # HTML to Markdown 库
│   └── logger.js          # 日志工具
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## ⚠️ 注意事项

- 仅能导出当前页面可见内容（付费文章仅能导出试读部分）
- 不抓取评论区内容
- 图片使用远程链接，需联网查看