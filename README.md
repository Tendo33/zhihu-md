# Zhihu-md

将知乎专栏/问答页面内容无损转换为 Markdown 格式并下载的 Chrome 扩展插件。

## ✨ 功能特性

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

1. 打开任意知乎专栏文章 (`zhuanlan.zhihu.com/p/...`) 或问答页面
2. 点击浏览器右上角的 Zhihu-md 图标
3. 确认文章信息无误后，点击「导出 Markdown」按钮
4. 选择保存位置，完成下载

## 📁 项目结构

```
zhihu-md/
├── manifest.json          # Chrome 扩展配置
├── popup/
│   ├── popup.html         # 弹出窗口 UI
│   ├── popup.js           # 弹出窗口逻辑
│   └── popup.css          # 样式
├── content/
│   └── content.js         # 内容脚本（DOM 解析）
├── background/
│   └── background.js      # Service Worker
├── lib/
│   └── turndown.min.js    # HTML to Markdown 库
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## ⚠️ 注意事项

- 仅能导出当前页面可见内容（付费文章仅能导出试读部分）
- 不抓取评论区内容
- 图片使用远程链接，需联网查看