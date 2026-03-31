# 架构总览

## 模块分层

仓库当前可以分成 5 层：

1. 清单层：`manifest.json`
2. 前台交互层：`popup/`、`options/`
3. 内容抓取层：`content/content.js` 和 `content/modules/`
4. 公共工具层：`lib/`
5. 文件输出层：`background/background.js`

## 顶层结构

```text
manifest.json
background/background.js
content/content.js
content/modules/*
popup/*
options/*
lib/*
scripts/*
```

## 核心职责划分

### `manifest.json`

负责声明：

- Manifest V3
- `activeTab`、`downloads`、`storage` 权限
- 作用域 `*://*.zhihu.com/*`
- `popup/popup.html`
- `options/options.html`
- `background/background.js`
- 注入到知乎页面的内容脚本与样式

### `popup/`

弹窗是“用户确认当前页面状态”的入口。

关键文件：

- `popup/popup.html`: 弹窗结构
- `popup/popup.css`: 弹窗样式
- `popup/popup.js`: 页面检测、状态展示、导出触发、打开设置页

它会：

- 查询当前激活标签页
- 用 `PageTypeUtils` 粗判页面类型
- 发消息给内容脚本获取标题和作者
- 在导出按钮点击后发起导出请求

### `options/`

设置页负责保存可持久化配置。

关键文件：

- `options/options.html`
- `options/options.css`
- `options/options.js`

当前配置项：

- `showFloatingBall`
- `maxAnswerCount`
- `downloadImages`

这些值保存在 `chrome.storage.sync`。

### `content/content.js`

这是内容脚本入口，也是页面侧的总调度器。

主要职责：

- 防止重复注入
- 检查依赖模块是否已挂到 `window`
- 创建悬浮球初始化调度器
- 监听来自弹窗或后台的消息
- 监听 `chrome.storage` 变化，实时增删悬浮球
- 通过 `MutationObserver` 在页面结构变化后重新挂载悬浮球

### `content/modules/detector.js`

负责识别页面类型，当前支持：

- `column`
- `answer`
- `question`
- `home`
- `follow`
- `hot`

### `content/modules/exporters/`

这是导出核心逻辑。

#### `article.js`

负责：

- 专栏文章导出
- 单条回答导出
- 单篇内容 Front Matter 生成
- 不需要的 DOM 清理
- 下载图片模式下的图片收集

#### `question.js`

负责：

- 问题页自动滚动
- 按配置上限采集多个回答
- 逐条回答转换为 Markdown
- 输出多回答整合文档

#### `feed.js`

负责：

- 首页推荐 / 关注动态自动滚动
- 尝试展开内容
- 标题去重
- 输出列表型 Markdown

#### `hot.js`

负责：

- 提取热榜排名、标题、链接、热度
- 在热榜 DOM 不稳定时回退到问题链接扫描

### `content/modules/floating-ball.js`

负责页面内悬浮导出按钮：

- 创建按钮节点
- 处理拖拽与停靠
- 记住位置
- 根据页面类型切换导出器
- 在成功、失败、加载中切换视觉状态

这是复杂页面导出的主入口。

### `content/modules/turndown-rules.js`

封装知乎页面专用的 Markdown 转换规则，包括：

- 公式
- 图片
- 代码块
- 链接卡片
- 视频卡片
- 表格
- 引用
- 换行和分隔线

### `lib/page-detector.js`

把 URL 判定逻辑抽成共享工具，供弹窗和内容脚本共同使用。

### `lib/init-scheduler.js`

用于限制悬浮球重复初始化的频率，避免动态页面中短时间反复重建。

### `background/background.js`

后台脚本只负责文件落地：

- 接收导出结果
- 普通 Markdown 直接下载
- 图片模式下逐张下载图片
- 自行组装 ZIP 文件后下载

## 数据流概览

### 单篇导出

1. 用户点击弹窗按钮或悬浮球。
2. 内容脚本调用 `ArticleExporter.exportMarkdown()`。
3. `createTurndownService()` 把 DOM 转成 Markdown。
4. 后台脚本接收内容并调用 `chrome.downloads.download()`。

### 批量导出

1. 用户点击悬浮球。
2. 悬浮球根据页面类型路由到 `QuestionExporter`、`FeedExporter` 或 `HotExporter`。
3. 导出器负责滚动加载、抽取条目、整理 Markdown。
4. 后台脚本统一处理下载。

## 持久化数据

### `chrome.storage.sync`

- `showFloatingBall`
- `maxAnswerCount`
- `downloadImages`

### `chrome.storage.local`

- `floatingBallPosition`

## 阅读建议

如果你第一次接手这个项目，建议按下面顺序读代码：

1. `manifest.json`
2. `popup/popup.js`
3. `content/content.js`
4. `content/modules/detector.js`
5. `content/modules/exporters/article.js`
6. `content/modules/exporters/question.js`
7. `content/modules/exporters/feed.js`
8. `content/modules/exporters/hot.js`
9. `background/background.js`
10. `scripts/package.js`
