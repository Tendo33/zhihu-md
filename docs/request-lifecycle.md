# 导出链路

这份文档聚焦“用户点了一次导出后，到底发生了什么”。

## 链路一：弹窗打开时的页面识别

入口文件：`popup/popup.js`

### 步骤

1. 弹窗调用 `chrome.tabs.query({ active: true, currentWindow: true })` 获取当前标签页。
2. 用 `PageTypeUtils.checkUrlType()` 粗判页面是不是知乎页面、属于哪一类页面。
3. 如果页面受支持，弹窗向内容脚本发送 `getArticleInfo`。
4. 内容脚本在 `content/content.js` 中收到消息后调用 `ArticleExporter.getArticleInfo()`。
5. `ArticleExporter` 读取标题、作者和页面类型，返回给弹窗。
6. 弹窗显示“就绪”、标题、作者和页面类别。

### 这一步的价值

- 让用户知道扩展是否识别成功
- 提前暴露“需要刷新页面”这类通信问题
- 为后续导出建立页面上下文

## 链路二：弹窗按钮导出

入口文件：`popup/popup.js`

### 步骤

1. 用户点击 `导出 Markdown`。
2. 弹窗向内容脚本发送 `exportMarkdown`。
3. 内容脚本当前会把这个动作路由到 `ArticleExporter.exportMarkdown()`。
4. `ArticleExporter`：
   - 判定页面类型
   - 找正文容器
   - 预清理无关 DOM
   - 调用 `createTurndownService()` 生成 Markdown
   - 生成文件名和 Front Matter
5. 弹窗把导出结果发给后台脚本。
6. 后台脚本调用下载接口保存文件。

### 适合的页面

- 专栏文章
- 单条回答

### 注意点

复杂页面的批量导出能力主要由悬浮球链路承担，因此问题页、首页、关注页和热榜页更推荐使用悬浮球触发。

## 链路三：悬浮球导出

入口文件：`content/modules/floating-ball.js`

### 初始化阶段

1. `content/content.js` 通过 `InitScheduler` 调度 `FloatingBall.init()`。
2. `FloatingBall.init()` 检查页面类型与 `showFloatingBall` 设置。
3. 如果允许展示，则创建悬浮球，恢复位置并绑定拖拽、点击事件。

### 点击导出阶段

1. 悬浮球读取页面类型。
2. 悬浮球读取设置：
   - `downloadImages`
   - `maxAnswerCount`
3. 根据页面类型路由：
   - `question` -> `QuestionExporter.exportMultipleAnswers()`
   - `home` / `follow` -> `FeedExporter.exportFeedItems(pageType)`
   - `hot` -> `HotExporter.exportHotList()`
   - 其他 -> `ArticleExporter.exportMarkdown(downloadImages)`
4. 成功后向后台脚本发送下载消息。
5. 悬浮球切换成功状态；失败时切换错误状态。

## 链路四：图片打包下载

入口文件：

- `content/modules/turndown-rules.js`
- `background/background.js`

### 步骤

1. 单篇导出在图片模式下先执行 `startImageCollection()`。
2. 自定义图片规则把原图 URL 收集到 `imageCollector`。
3. Markdown 中图片路径被改写为 `images/文件名`。
4. 内容脚本把 `content`、`filename`、`images` 一并发给后台脚本。
5. 后台脚本逐张 `fetch()` 图片。
6. 后台脚本用内置 ZIP 组装逻辑把 Markdown 和图片打成一个压缩包。
7. 最终下载 `<原文件名>_with_images.zip`。

## 链路五：设置生效

### 设置页写入

入口文件：`options/options.js`

写入内容：

- `showFloatingBall`
- `maxAnswerCount`
- `downloadImages`

### 内容页监听

入口文件：`content/content.js`

逻辑：

- 监听 `chrome.storage.onChanged`
- 如果 `showFloatingBall` 被关闭，立即移除悬浮球
- 如果重新开启，则重新初始化悬浮球

## 调试建议

### 想排查页面识别失败

先看：

- `lib/page-detector.js`
- `content/modules/detector.js`

### 想排查导出内容不完整

先看：

- `content/modules/exporters/article.js`
- `content/modules/exporters/question.js`
- `content/modules/exporters/feed.js`
- `content/modules/exporters/hot.js`

### 想排查下载失败或 ZIP 异常

先看：

- `background/background.js`
- `content/modules/turndown-rules.js`

## 手动 trace 一次请求

建议用下面顺序验证：

1. 打开一个知乎文章页
2. 弹出扩展面板，确认状态为“就绪”
3. 点击导出按钮
4. 在内容脚本侧确认 `ArticleExporter.exportMarkdown()` 被调用
5. 在后台脚本侧确认收到 `download` 消息
6. 检查浏览器是否弹出保存对话框或开始下载
