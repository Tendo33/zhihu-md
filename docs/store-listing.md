# Chrome 应用商店上架文案

「to Markdown」系列三款插件（arXiv to Markdown / Zhihu to Markdown / Journal to Markdown）用同一套结构写商店文案：名称 → 简短说明 → 详细说明（一句话、能做什么、怎么用、隐私、同系列）。改动时三份一起改。

- 名称、简短说明和扩展包里的 `_locales/*/messages.json`（`extDescription`）保持一致，简短说明不超过 132 个字符。
- 详细说明只写扩展实际做到的事；隐私段与 [PRIVACY.md](../PRIVACY.md) 一致。

## 基本信息

| 项 | 内容 |
| --- | --- |
| 名称 | Zhihu to Markdown（所有语言相同，不翻译） |
| 类别 | 工具（Tools） |
| 语言 | 中文（简体）、English |
| 主页 | https://github.com/Tendo33/zhihu-md |
| 支持 | https://github.com/Tendo33/zhihu-md/issues |
| 隐私政策 | https://github.com/Tendo33/zhihu-md/blob/main/PRIVACY.md |

## 简短说明

**中文**

> 一键把知乎文章、回答、问题和热榜存为 Markdown：公式、代码、图片原样保留，可下载也可复制。

**English**

> Save Zhihu articles, answers, questions and the hot list as Markdown in one click: math, code and images intact. Download or copy.

## 详细说明（中文）

```text
把知乎上值得留下的内容一键存为干净的 Markdown，直接放进 Obsidian、Notion、Typora，或交给 AI 阅读。

能做什么
• 专栏、回答一键导出：生成带 YAML 头信息（标题、作者、链接、时间）的 Markdown 文件。
• 问题页批量导出：按顺序导出多个回答，默认 20 条，最多 1000 条。
• 首页推荐、关注动态、热榜：整理成清单，热榜带排名和热度。
• 格式完整：标题层级、列表、引用；公式转 $…$ / $$…$$；代码块保留并识别语言；表格转 Markdown。
• 图片可打包：开启「下载图片到本地」后导出为含 images 文件夹的 ZIP。
• 复制 Markdown：弹窗、悬浮球右键、右键菜单都能复制，也可以只复制选中的内容。
• 页面悬浮球：可拖拽、靠边停靠、记住位置，可在设置里关闭。
• 最近导出记录，刚保存的文件一键在文件夹中显示。
• 跟随系统浅色 / 深色。

怎么用
1. 打开知乎的专栏文章、回答、问题、首页、关注或热榜页。
2. 点页面右下角的悬浮球，或点工具栏图标后选「导出 Markdown」；快捷键 Alt+Shift+K。
3. 想直接粘贴到编辑器，选「复制 Markdown」。

隐私
• 没有自己的服务器，没有统计或埋点。
• 页面内容只在你的浏览器里转换，不上传给开发者或第三方。
• 只处理你打开的页面；不绕过登录或付费限制，默认不抓评论区。

同系列
• arXiv to Markdown：arXiv 论文存为 Markdown，PDF 按标题命名。
• Journal to Markdown：PMC、Nature、Frontiers 等期刊全文存为 Markdown。

需要 Chrome 121 或更高版本。

开源（MIT）：github.com/Tendo33/zhihu-md
```

## 详细说明（English）

```text
Save the Zhihu content worth keeping as clean Markdown in one click — ready for Obsidian, Notion, Typora, or your AI assistant.

What it does
• Articles and answers: one Markdown file with YAML front matter (title, author, link, date).
• Question pages: export many answers in order — 20 by default, up to 1,000.
• Home feed, Following and the hot list: saved as tidy lists; the hot list keeps rank and heat.
• Formatting intact: headings, lists and quotes; math as $…$ / $$…$$; code blocks with language; tables as Markdown.
• Bundle images: turn on "Download images" to get a ZIP with an images folder.
• Copy Markdown from the popup, the floating ball (right-click) or the context menu — or copy just your selection.
• Floating ball: drag it, dock it to an edge, it remembers where you left it; can be turned off.
• Recent exports, with one click to show the file in its folder.
• Follows your light or dark theme.

How to use
1. Open a Zhihu article, answer, question, home feed, Following or hot list page.
2. Click the floating ball, or click the toolbar icon and choose Export Markdown. Shortcut: Alt+Shift+K.
3. To paste straight into an editor, choose Copy Markdown.

Privacy
• No servers of our own, no analytics.
• Pages are converted in your browser and never uploaded to the developer or any third party.
• Only the pages you open are processed; login and paywalls are never bypassed, and comments are not collected.

Also in the series
• arXiv to Markdown — save arXiv papers as Markdown, PDFs named by title.
• Journal to Markdown — save full-text articles from PMC, Nature, Frontiers and more as Markdown.

Requires Chrome 121 or later.

Open source (MIT): github.com/Tendo33/zhihu-md
```

## 图片素材（中文，可直接上传）

全部由真实扩展界面截取后合成，三款插件同一版式。生成方式：无界面 Chromium 加载 `dist/`，截取弹窗、设置页和页面内元素，导出的 Markdown 来自真实导出结果（知乎页面为演示页，内容不来自真实用户）。

| 文件 | 尺寸 | 内容 |
| --- | --- | --- |
| `docs/store/screenshot-1.png` | 1280×800 | 一键把知乎内容存为 Markdown（演示页 + 弹窗） |
| `docs/store/screenshot-2.png` | 1280×800 | 公式、代码、表格原样保留（导出的 Markdown） |
| `docs/store/screenshot-3.png` | 1280×800 | 按需导出，图片可打包（设置页） |
| `docs/store/screenshot-4.png` | 1280×800 | 浅色、深色都顺眼（深色模式） |
| `docs/store/promo-small-440x280.png` | 440×280 | 小型宣传图块（必填） |
| `docs/store/promo-marquee-1400x560.png` | 1400×560 | 顶部宣传图块（可选） |
| `docs/store/description.zh.txt` | — | 中文详细说明，粘贴到「说明」 |

## 单一用途说明

> 把用户正在浏览的知乎页面（文章、回答、问题、信息流、热榜）转换为 Markdown，下载到本地或复制到剪贴板。

Converts the Zhihu page the user is viewing (article, answer, question, feed or hot list) into Markdown, saved locally or copied to the clipboard.

## 权限理由

各权限的用途见 [README 权限说明](../README.md#权限说明)。提交审核时按该表逐项填写。
