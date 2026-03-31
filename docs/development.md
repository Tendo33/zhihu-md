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
4. 指向仓库根目录

### 代码修改后

- 修改内容脚本、弹窗、设置页或后台脚本后，通常需要刷新扩展
- 如果是页面注入逻辑变更，最好同时刷新知乎页面

## 常用命令

### 运行测试

```bash
node scripts/test-init-scheduler.js
```

当前仓库内已有的自动化测试主要覆盖 `lib/init-scheduler.js` 的调度逻辑。

### 打包产物

```bash
npm run package
```

这个命令会：

1. 清空并重建 `dist/`
2. 拷贝清单、前台页面、内容脚本、后台脚本、图标、文档
3. 生成 `dist/zhihu-to-markdown-v<version>.zip`

## 关键文件说明

### `manifest.json`

需要关注：

- `version`
- `permissions`
- `host_permissions`
- `content_scripts`
- `background`
- `options_ui`

### `scripts/package.js`

打包脚本会尝试包含这些内容：

- `manifest.json`
- `popup/`
- `options/`
- `content/`
- `background/`
- `lib/`
- `icons/`
- `README.md`
- `MANIFEST_UPDATE.md`

如果某个文件不存在，脚本会跳过并给出提示。

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
