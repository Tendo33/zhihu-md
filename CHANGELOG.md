# Changelog

## [Unreleased]

## [1.1.9] - 2026-10-30

### 改进

- 界面视觉精修：弹窗主按钮、卡片、提示条、快捷键标签的阴影和描边更细致；当前页面卡片带品牌色浅底和状态圆点。
- 设置页页眉加上扩展图标和名称，卡片圆角、阴影和页脚底色更柔和。
- 悬浮导出球加上顶部高光和柔和的品牌色投影（深色下仍为中性投影），提示框投影更有层次。

## [1.1.8] - 2026-10-29

### 新增

- 商店名称和简介支持中英文。

### 修复

- 以 `//` 开头的图片在 Markdown 里写成 `https://` 地址（包括开启「下载图片」后没能下载或按规则保留在线链接的图片），本地打开 .md 时不再变成 file:// 断链。
- 部分导出时，悬浮导出球的读屏文字也会说明有多少张图片没能下载、多少张保留为在线链接，和弹窗提示一致。
- 图片没能下载时的提示统一改为「N 张图片未能下载，已保留在线链接」（弹窗、悬浮导出球和读屏文字一致）；部分导出的读屏文字里，导出概况和图片情况之间改用「；」分隔。
- 知乎图床（zhimg.com）的 http 图片写进 Markdown 时改用 `https://`；其他网站的 http 图片地址保持不变。
- 「最大下载条数」按说明最多 1000 条：设置页输入框限制为 1000，保存时超过 1000 的数字改成 1000；以前保存过或从其他设备同步来的更大数字，导出时也按 1000 条算。填 0 表示上限内不限：问题页和信息流都最多 1000 条。设置页输入超过 1000 时，保存后提示「超过上限，已保存为 1000」；输入负数或小于 1 的小数时保存为 1，并提示「需为 0 或正整数，已保存为 1」。
- 首页推荐和关注动态导出时，如果滚动停在上限、滚动超时，或页面上的卡片超过上限被截掉，文首和问题页一样写 `truncated: true`；只有连续 3 轮没有新卡片且全部导出时才不写。
- Chrome / Edge 包的 manifest 不再带 `background.scripts`，Chrome 扩展页不再提示「'background.scripts' requires manifest version of 2 or lower」。Firefox 包另用 `npm run build:firefox` 构建到 `dist-firefox/`，保留 `background.scripts`。

### 改进

- 右键菜单和快捷键说明的中文统一为「导出本页为 Markdown」「复制本页为 Markdown」，知乎链接上的菜单改为「导出链接的知乎页面为 Markdown」；英文版改为「Export this page as Markdown」「Export linked Zhihu page as Markdown」。
- 设置页按设计稿重做：开关只显示一个圆钮，标题改为「最大下载条数」并加单位「条」，三项说明换成新文案；保存后在页脚显示「✓ 已保存」；标签可点击，开关对读屏软件报为「开关」。
- 悬浮导出球的悬停提示框上下内边距由 5px 改为 6px，符合界面 2 的倍数间距规范。
- 英文界面下，悬浮导出球的悬停提示、读屏文字、进度和成功/失败提示改为英文（如「Click to export · Right-click to copy」）；中文界面文案不变。
- 深色模式下（知乎夜间模式或系统深色）悬浮导出球改用 #1a6ae0 底色白色图标，悬停提示框改为深底浅字，在深色页面上更清晰。

## [1.1.7] - 2026-10-29

### 新增

- 右键菜单：在专栏文章、问题 / 回答、热榜、关注页和首页右键可「导出本页为 Markdown」「复制本页 Markdown」，选中文字可「复制选中内容为 Markdown」；在任意网站右键指向知乎问题、回答或专栏文章的链接，可「打开并导出这个知乎链接」。
- 快捷键导出当前页。新安装默认 `Alt+Shift+K`（macOS 为 `Option+Shift+K`）；Windows / Linux 上 Chrome 把 `Alt+Shift+Z` 留给了标签组，旧快捷键注册不上。已安装用户保留原有快捷键，以弹窗底栏显示为准。
- 没有分配快捷键时，弹窗底栏显示「快捷键未设置 · 去设置」，点击打开浏览器的快捷键设置页（Firefox 显示文字提示）。
- 弹窗显示最近 3 条导出记录。

### 改进

- 弹窗改版：当前页卡片、导出 / 复制按钮、出错时直接显示原因并可重试。
- 导出失败时说明具体原因：页面还没加载完、需要登录、需要安全验证或被知乎限流。
- 悬浮导出球改为 M↓ 图标加进度环，导出中、成功、失败一眼可分；支持键盘操作和读屏。
- 导出过程统一显示「正在导出…」；设置项更名为「悬浮导出球」并写明出现位置；设置页数字输入框加了可见边框；支持深色模式。
- 批量导出问题回答时，如果中途有一页加载失败，会提示「已导出 N/M 条，部分失败」，文件末尾也会注明内容不完整，不再显示成「已导出」。
- 开启「下载图片」时，下载失败的图片在 Markdown 里保留原始在线链接，不再留下打不开的 images/ 路径，并提示「N 张图片下载失败，已保留在线链接」；打包的图片按实际格式命名（例如 .jpg 链接实际是 PNG 时存为 .png）。SVG、ico、无法识别格式和非知乎图床（zhimg.com）的图片不打包，保留在线链接，单独提示「N 张图片保留为在线链接」，不算下载失败；http 和 // 开头的知乎老图改用 https 下载。部分导出时「打开」按钮放在警告提示里。
- 最近导出里同一标题只保留最新一条；出错提示显示时最近导出缩为 2 条。

### 变更

- 最低支持版本提高到 Chrome 121（为支持 Firefox 加入了 MV3 `background.scripts`，Chrome 121 之前会报错）。Chrome 111–120 将无法安装或更新到此版本。

### 修复

- 知乎跳转链接（link.zhihu.com）还原成真实地址；带括号的链接、mailto: 和 tel: 链接导出后可以正常点击。
- 链接卡片各占一段，卡片标题里的 `<`、`*`、`[` 等字符原样保留。
- 正文里像 `<标签>` 这样的文字在 Markdown 预览里不再被吞掉；标题开头的「1.」不再被多余转义。
- 回答页和专栏页对尖括号文字的处理一致；空段落、代码块空行、协议相对链接等格式问题已修正，支持参考文献脚注。
- 热榜导出的 front matter `url` 与其他导出器一样加了引号。

## [1.1.6] - 2026-10-10

### Fixed

- Hot-list export keeps one row per item. The title no longer includes the excerpt, and the heat metric no longer includes the share control.
- Question export loads later answers from the Zhihu question feed API. A partial file sets `truncated: true`. A limit of 0 downloads as many answers as the page declares, up to 1000.
- Answer export uses the answer's own id and author. An empty avatar link is not the author name, and a cited answer is not the item itself.
- Feed cards expand only 阅读全文, 展开, or 显示全部. Titles come from the card heading, and relative times such as 昨天 and 3 小时前 are kept.
- Display math, link-card titles, raw video elements, and lazy images follow the current article markup.

### Changed

- Front matter quotes `title`, `url`, `author`, `created`, and `edited`.
- Question downloads pack images when local image download is enabled. Copy still keeps remote image URLs.
- Question subpaths such as `/question/.../log` are not treated as question pages.

## [1.1.5] - 2026-09-28

### Fixed

- The action popup stays 360px wide. Viewport units made Chrome collapse it into a strip, so the title, status, and buttons wrapped.

## [1.1.4] - 2026-09-28

### Changed

- `npm run build` writes the unpacked extension to `dist/`. `npm run package` writes `build/zhihu-to-markdown-v<version>.zip`.
- A `v*` tag publishes that zip with the same GitHub Release workflow as arXiv to Markdown.
- The docs index follows the same order: usage, architecture, one click, then build and release.

## [1.1.3] - 2026-09-28

### Added

- Copy Markdown from the popup, or by right-clicking the floating button. Clicking the button still downloads.
- Copy keeps working after the button has been dragged, and after a long question or feed export.

### Changed

- Content script, popup, options, and background are bundled. Load `dist/` after `npm run build`. The store zip is `build/zhihu-to-markdown-v<version>.zip`.
- The floating button only watches direct children of `document.body`.

### Fixed

- Page detection rejects lookalike hosts, and answer export targets the answer in the URL.
