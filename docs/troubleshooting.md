# 常见问题与排查

## 弹窗提示“此页面不是知乎页面”

先检查：

- 当前标签页是否真的在 `*.zhihu.com`
- URL 是否属于支持的页面类型
- 是否打开的是浏览器内部页面、PDF 或扩展页

相关代码：

- `lib/page-detector.js`
- `content/modules/detector.js`
- `popup/popup.js`

## 弹窗提示“请刷新知乎页面后重试”

这通常表示弹窗与内容脚本没有成功建立连接。

建议操作：

1. 刷新当前知乎页面
2. 重新打开弹窗
3. 如果刚刚更新了扩展，先在 `chrome://extensions/` 里刷新扩展，再刷新知乎页面

相关代码：

- `popup/popup.js`
- `content/content.js`

## 只有部分回答被导出

常见原因：

- 页面还没滚动加载出更多回答
- `最大下载回答数` 设置过低
- 知乎页面结构变了，部分 `.AnswerItem` 未被识别

先检查：

- 设置页中的 `最大下载回答数`
- `content/modules/exporters/question.js`

## 首页 / 关注页导出结果偏少

常见原因：

- 信息流尚未滚动到足够位置
- 页面中出现了未匹配的新卡片结构
- 标题去重后减少了最终条目数

先检查：

- `content/modules/exporters/feed.js`
- `CONSTANTS.DEFAULTS.SCROLL_TIMEOUT`
- `CONSTANTS.DEFAULTS.SCROLL_INTERVAL`

## 热榜导出失败

可能原因：

- 当前页面不是 `/hot`
- 热榜 DOM 结构发生变化
- 页面尚未完成加载

扩展当前有两层提取策略：

1. 优先提取热榜专用 DOM 结构
2. 回退到问题链接扫描

如果两层都失效，需要更新 `content/modules/exporters/hot.js` 的选择器。

## 图片没有被打包到 ZIP

先确认：

- 是否开启了“下载图片到本地”
- 当前是否为单篇文章或单条回答导出
- 图片地址是否还能被浏览器访问

注意：

- 多回答、信息流和热榜导出不会进入图片打包链路
- 后台脚本下载图片失败时会跳过失败图片，而不是中断全部导出

相关代码：

- `content/modules/turndown-rules.js`
- `background/background.js`

## 悬浮球不显示

可能原因：

- 设置里关闭了悬浮导出按钮
- 当前页面不是支持的页面类型
- 页面刚完成无刷新跳转，悬浮球还未重新初始化

先检查：

- 设置页 `showFloatingBall`
- `content/content.js` 中的 `MutationObserver`
- `lib/init-scheduler.js`
- `content/modules/floating-ball.js`

## 悬浮球位置异常

悬浮球位置保存在 `chrome.storage.local` 的 `floatingBallPosition` 中。

如果出现越界或停靠异常：

- 尝试拖动到新位置再释放
- 重新打开页面让位置重新校正
- 检查浏览器窗口尺寸是否与保存位置差异过大

## 打包失败

先检查：

- 本机是否安装了 `zip` 命令
- `dist/` 是否可写
- `manifest.json` 是否为合法 JSON
- `MANIFEST_UPDATE.md` 是否误删且你又希望它被打进包中

相关代码：

- `scripts/package.js`

## 排查顺序建议

如果你不确定问题在哪一层，建议按这个顺序排查：

1. 页面是否匹配支持的 URL
2. 弹窗是否能识别页面
3. 内容脚本是否收到消息
4. 导出器是否成功提取 DOM
5. 后台脚本是否收到下载请求
6. 浏览器下载接口是否成功执行
