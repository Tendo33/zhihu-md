# 开发与维护

## 开发环境

### 前置要求

- Node.js
- npm
- Chrome 或其他兼容 Manifest V3 的 Chromium 浏览器

### 安装依赖

```bash
npm install
```

当前项目运行时依赖很轻，开发相关脚本主要集中在 `scripts/`。

## 本地调试

### 加载扩展

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 指向 `dist/`

内容脚本、弹窗和后台都由 esbuild 打成单独的包。改完源码后先执行 `npm run build`，再在 `chrome://extensions` 里刷新扩展。页面注入逻辑变更时同时刷新知乎页面。

## 常用命令

### 运行测试

```bash
npm test
```

`npm test` 覆盖页面分类、悬浮球调度、文件名和 Front Matter、ZIP 字节结构，以及公式、代码块、表格、链接卡片的 HTML 夹具。`npm run test:detector` 仍只跑页面分类。

### 打包产物

```bash
npm run package
```

这个命令会：

1. 用 esbuild 把内容脚本、弹窗、设置页和后台打进 `dist/`
2. 带上样式、图标、清单和说明
3. 生成 `build/zhihu-to-markdown-v<version>.zip`

## 关键文件说明

### `manifest.json`

需要关注：

- `version`
- `permissions`
- `host_permissions`
- `content_scripts`
- `background`
- `options_ui`

### `scripts/build.js`

构建产物里的清单只注入一个 `content/content.js`。弹窗和设置页也各自只引用打好的脚本。本地加载请选择 `dist/`，不要选择仓库根目录。商店包在 `build/`。

## 新功能开发建议

### 新增页面类型时

至少同步检查这些位置：

1. `lib/page-detector.js`
2. `content/modules/detector.js`
3. 对应 exporter 文件
4. `popup/popup.js` 的页面标签映射
5. `README.md` 和 `docs/usage.md`

### 修改导出格式时

重点检查：

- `content/modules/turndown-rules.js`
- `content/modules/exporters/article.js`
- `content/modules/exporters/question.js`
- `content/modules/exporters/feed.js`
- `content/modules/exporters/hot.js`

### 修改悬浮球交互时

重点检查：

- `content/modules/floating-ball.js`
- `content/content.js`
- `content/content.css`
- `options/options.js`

## 发版流程

### 1. 更新版本号

至少同步以下文件：

- `manifest.json`
- `package.json`
- `package-lock.json`
- `options/options.html` 页脚中的版本文案

### 2. 核对文档

至少检查：

- `README.md`
- `PRIVACY.md`
- `docs/`
- `MANIFEST_UPDATE.md`

### 3. 本地验证

建议执行：

```bash
node scripts/test-init-scheduler.js
npm run package
```

### 4. 检查打包结果

确认：

- ZIP 文件名版本正确
- 扩展能正常加载
- 弹窗能识别页面
- 悬浮球能显示并导出
- 单篇图片下载模式能正确生成 ZIP

## 发布前检查清单

发布前请对照根目录的 [MANIFEST_UPDATE.md](../MANIFEST_UPDATE.md)。

## 文档维护约定

以后每次改动以下内容时，都应该顺手更新文档：

- 支持的页面类型
- 新增或删除的配置项
- 导出格式变化
- 权限变化
- 打包或发布流程变化

建议最少同步更新：

- `README.md`
- `docs/usage.md`
- `docs/architecture.md`
- `PRIVACY.md`
