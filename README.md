# Zhihu to Markdown

<div align="center">

将知乎页面整理成适合继续编辑、归档和发布的 Markdown 文件。  
当前版本支持专栏、回答、问题页多回答、首页推荐、关注动态和热榜页面导出。

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/heeilejdelmogpbnbbhdokgfabmhkenh?style=flat-square&label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/zhihu-md/heeilejdelmogpbnbbhdokgfabmhkenh?authuser=0&hl=zh-CN)
[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=flat-square)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](./manifest.json)

[Chrome Web Store](https://chromewebstore.google.com/detail/zhihu-md/heeilejdelmogpbnbbhdokgfabmhkenh?authuser=0&hl=zh-CN)
•
[使用说明](./docs/usage.md)
•
[架构文档](./docs/architecture.md)
•
[导出链路](./docs/request-lifecycle.md)
•
[开发维护](./docs/development.md)
•
[常见问题](./docs/troubleshooting.md)
•
[隐私说明](./PRIVACY.md)

</div>

## 项目简介

知乎内容直接复制到编辑器时，通常会遇到这些问题：

- 正文结构被打散
- 公式、代码块、表格和链接卡片不好处理
- 图片链接混杂缩略图参数，不适合后续归档
- 问题页、信息流、热榜这类聚合页面很难一次性整理

`Zhihu to Markdown` 的目标很明确：把你当前已经加载在浏览器里的知乎内容，尽可能稳定地转换为可继续编辑的 Markdown 文件。

它不是爬虫，不绕过权限，也不访问你当前页面之外的隐藏内容。扩展只处理浏览器里已经展示出来的页面内容，并将结果下载到本地。

## 当前能力

### 支持的页面类型

| 页面类型 | URL 示例 | 导出方式 | 结果概览 |
| --- | --- | --- | --- |
| 专栏文章 | `https://zhuanlan.zhihu.com/p/...` | 弹窗 / 悬浮球 | 单个 Markdown 文件 |
| 单条回答 | `https://www.zhihu.com/question/.../answer/...` | 弹窗 / 悬浮球 | 单个 Markdown 文件 |
| 问题页 | `https://www.zhihu.com/question/...` | 悬浮球优先 | 批量整理多个回答 |
| 首页推荐 | `https://www.zhihu.com/` | 悬浮球优先 | 导出信息流列表 |
| 关注动态 | `https://www.zhihu.com/follow` | 悬浮球优先 | 导出关注页信息流 |
| 热榜页 | `https://www.zhihu.com/hot` | 悬浮球优先 | 导出热榜清单 |

### Markdown 转换特性

- 自动生成 YAML Front Matter
- 保留标题层级、段落、列表和引用
- 数学公式转换为 `$...$` 或 `$$...$$`
- 代码块保留 fenced code block 语法并尝试识别语言
- 链接卡片降级为普通 Markdown 链接
- 表格转换为 Markdown 表格
- 图片可保留远程链接，也可打包下载到本地 ZIP
- 文件名会清理非法字符，减少下载失败

### 交互能力

- 弹窗会识别当前页面类型并展示标题、作者、页面类别
- 可选右下角悬浮导出按钮
- 悬浮球支持拖拽、靠边停靠、位置记忆
- 设置项会持久化到 `chrome.storage.sync`
- 悬浮球位置保存在 `chrome.storage.local`

## 界面截图

### 弹出面板

<img src="assets/popup.png" alt="Popup Screenshot" width="220">

### 导出结果示例

原始页面：

<img src="assets/export_origin.png" alt="Original Zhihu Page" width="500">

导出后的 Markdown：

<img src="assets/export-result.png" alt="Markdown Export Result" width="720">

### 设置页面

<img src="assets/options.png" alt="Options Screenshot" width="500">

### 页面悬浮球

<img src="assets/floating-ball.png" alt="Floating Ball Screenshot" width="240">

## 快速开始

### 方式一：从 Chrome Web Store 安装

直接安装：

<a href="https://chromewebstore.google.com/detail/zhihu-md/heeilejdelmogpbnbbhdokgfabmhkenh?authuser=0&hl=zh-CN">
  <img src="https://img.shields.io/badge/Install%20from-Chrome%20Web%20Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Install from Chrome Web Store">
</a>

安装后：

1. 打开一个支持的知乎页面。
2. 点击浏览器工具栏中的扩展图标。
3. 在弹窗里查看页面状态并执行导出，或直接点击页面右下角悬浮球导出。

### 方式二：开发者模式加载

```bash
git clone https://github.com/Tendo33/zhihu-md.git
cd zhihu-md
```

然后在 Chrome 中：

1. 打开 `chrome://extensions/`
2. 启用右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前项目根目录

## 使用说明

### 导出专栏或单条回答

进入文章页或回答页后，可以直接通过弹窗或悬浮球导出。

适合这些场景：

- 备份自己写过的内容
- 迁移到 Obsidian、Typora、Notion 等编辑器
- 二次整理到博客、知识库或 GitHub 仓库

### 导出问题页多个回答

问题页的批量导出逻辑由 `QuestionExporter` 负责：

- 自动滚动页面，尽量加载更多回答
- 最多导出 `1-50` 条回答，默认 `20`
- 结果按回答顺序分节整理
- 每条回答包含作者、创建时间、编辑时间和正文

复杂页面建议优先使用悬浮球触发导出，这条链路会根据页面类型自动切换到对应导出器。

### 导出首页推荐或关注动态

信息流页面的导出逻辑由 `FeedExporter` 负责：

- 自动滚动页面加载更多条目
- 尝试展开“阅读全文”内容
- 基于标题去重
- 输出作者、时间、原始链接和正文摘录

适合做：

- 日常阅读归档
- 选题池整理
- 热门内容回顾

### 导出热榜

热榜页导出由 `HotExporter` 负责，结果更偏清单型：

- 提取排名、标题、链接、热度信息
- 输出为适合二次整理的 Markdown 列表
- 如果页面结构有变化，会回退到问题链接扫描逻辑

## 配置项

| 配置项 | 说明 | 默认值 | 存储位置 |
| --- | --- | --- | --- |
| 悬浮导出按钮 | 是否显示右下角悬浮球 | 开启 | `chrome.storage.sync` |
| 最大下载回答数 | 问题页和信息流导出的最大条数，范围 `1-50` | `20` | `chrome.storage.sync` |
| 下载图片到本地 | 将文章中的图片打包到 ZIP 中 | 关闭 | `chrome.storage.sync` |
| 悬浮球位置 | 记录拖拽后的位置 | 自动写入 | `chrome.storage.local` |

### 图片下载模式

启用“下载图片到本地”后：

- 单篇文章 / 回答导出会生成 ZIP 包
- ZIP 中包含一个 Markdown 文件和一个 `images/` 目录
- Markdown 中的图片链接会改写为本地相对路径
- 后台脚本会逐张拉取图片并自行组装 ZIP 文件

## 输出格式示例

单篇内容默认会生成 Front Matter：

```yaml
---
title: "示例标题"
url: https://www.zhihu.com/question/...
author: 作者名
date: 2026-03-31
created: 2025-12-01
edited: 2025-12-03
---
```

问题页多回答导出会额外记录：

- `answer_count`
- 每条回答的章节标题
- 作者与时间信息

首页、关注页和热榜页会生成按条目组织的清单型文档。

## 文档索引

- [docs/README.md](./docs/README.md): 文档导航与阅读顺序
- [docs/usage.md](./docs/usage.md): 使用手册与导出结果说明
- [docs/architecture.md](./docs/architecture.md): 模块划分与职责
- [docs/request-lifecycle.md](./docs/request-lifecycle.md): 从点击导出到文件落地的全链路
- [docs/development.md](./docs/development.md): 本地开发、测试、打包和发布维护
- [docs/troubleshooting.md](./docs/troubleshooting.md): 常见问题与排查建议
- [MANIFEST_UPDATE.md](./MANIFEST_UPDATE.md): 版本发布前的清单更新说明

## 项目结构

```text
zhihu-md/
├── manifest.json
├── background/
│   └── background.js
├── content/
│   ├── content.js
│   ├── content.css
│   └── modules/
│       ├── constants.js
│       ├── detector.js
│       ├── floating-ball.js
│       ├── turndown-rules.js
│       └── exporters/
│           ├── article.js
│           ├── question.js
│           ├── feed.js
│           └── hot.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── lib/
│   ├── init-scheduler.js
│   ├── logger.js
│   ├── page-detector.js
│   ├── shared.css
│   └── turndown.min.js
├── scripts/
│   ├── package.js
│   └── test-init-scheduler.js
├── assets/
├── icons/
├── docs/
├── MANIFEST_UPDATE.md
├── PRIVACY.md
└── README.md
```

## 本地开发

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
node scripts/test-init-scheduler.js
```

### 打包扩展

```bash
npm run package
```

打包后会在 `dist/` 目录生成可上传到 Chrome Web Store 的 ZIP 文件。

更多开发和发布细节见 [docs/development.md](./docs/development.md)。

## 已知限制

- 扩展只能导出当前页面已经加载出来的内容
- 付费内容、折叠内容或未展开内容，是否可导出取决于当前页面是否可见
- 默认不抓取评论区
- 复杂页面的批量导出依赖页面结构，知乎改版后可能需要更新选择器
- 首页推荐、关注动态和热榜属于动态页面，导出结果会受滚动加载状态影响
- 图片本地打包模式只用于单篇文章和回答导出，不适用于批量信息流整理

## 隐私说明

扩展只在 `*.zhihu.com` 页面运行，当前实际权限为：

- `activeTab`
- `downloads`
- `storage`

详细说明见 [PRIVACY.md](./PRIVACY.md)。

## License

本项目基于 [MIT License](./LICENSE) 开源。
