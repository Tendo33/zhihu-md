# Zhihu to Markdown 全面审计与翻新记录

## 产品理解

这是一个 Manifest V3 Chrome 扩展：在知乎专栏、回答、问题、首页、关注和热榜页面注入内容脚本，识别页面并将内容转换为 Markdown；弹窗负责状态确认与导出，设置页管理悬浮球、回答数量和图片本地化，service worker 负责下载与 ZIP 打包。

## 原问题

- UI 采用分散的颜色变量，交互过渡使用 `transition: all`，会造成不必要的布局动画并违反界面规范。
- 弹窗和悬浮球的装饰 SVG 未声明为辅助技术隐藏，读屏器可能重复朗读。
- 数字设置缺少稳定的 `name`、`inputmode` 与自动填充策略。
- 视觉系统缺乏统一字体回退和基础控件继承规则。
- 当前仓库是原生 MV3 HTML/CSS/JS，不存在需要迁移的前端框架；引入框架会增加构建和注入复杂度。

## 已实施

- 保留原生 MV3 架构和已有知乎品牌图标，建立更稳定的系统字体栈与控件字体继承。
- 将 popup/options 的 `transition: all` 改为明确的颜色、边框、阴影和 transform 属性。
- 为装饰性 SVG 添加 `aria-hidden="true"`，保留按钮本身的可访问名称。
- 为最大回答数输入补充 `name`、`inputmode="numeric"`、`autocomplete="off"`。
- 保留现有深色模式、响应式断点、键盘 focus-visible、减弱动画和状态 live region。
- 修正 URL 判定：仅接受 `zhihu.com` 及其真实子域，拒绝 `evilzhihu.com` 等伪域名；统一尾斜杠/重复斜杠，并要求回答路径包含数字 answer id，避免把其它 `/question/*` 子路径误判为问题。
- 增强文章/回答容器回退选择器，覆盖 `data-za-detail-view-name` 和当前 `.RichText.ztext` 结构；回答页优先按 URL 中的 answer id 定位，避免导出页面上的第一条回答。
- 文件名清理现在移除控制字符并为空标题回退到 `zhihu-article`，避免生成 `.md` 或 ZIP 路径问题。
- 新增 `npm run test:detector`，对专栏、问题、回答、热榜、关注、首页、查询参数和伪域名做回归断言。

## 验证

- `npm run package`：应成功生成 `dist/` 打包产物。
- `node scripts/test-init-scheduler.js`：初始化调度器回归测试。
- `npm run test:detector`：URL 分类回归测试。
- `impeccable detect --json popup/popup.html popup/popup.css options/options.html options/options.css`：机械设计规则扫描。
- 浏览器中需由主任务验证 Chrome 弹窗、设置页、知乎页面悬浮球的实际布局、导出流程及深色/移动视口。

## 残留边界

仓库无自动化浏览器 E2E；知乎 DOM 结构和跨域图片下载依赖上游页面及浏览器权限。ZIP 实际下载、内容脚本生命周期、CSP 和浏览器 UI 需要在已安装扩展的 Chrome 会话中复核。

## 发布

本轮翻修版本：1.1.2。
