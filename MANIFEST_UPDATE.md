# 版本与清单更新说明

每次发布新版本前，请至少检查下面这些位置是否同步更新。

## 必须同步的文件

### `manifest.json`

确认：

- `version` 已更新
- `description` 与当前功能一致
- `permissions` 与实际代码使用一致
- `content_scripts` 列表覆盖当前注入文件

### `package.json`

确认：

- `version` 与 `manifest.json` 保持一致
- `description` 未过时

### `package-lock.json`

确认：

- 根包版本与 `package.json` 一致

### `options/options.html`

确认：

- 页面底部显示的版本号与本次发布一致

## 建议同步检查的文档

- `README.md`
- `PRIVACY.md`
- `docs/usage.md`
- `docs/architecture.md`
- `docs/development.md`

## 权限变更时必须做的事

如果新增、删除或调整了权限：

1. 更新 `manifest.json`
2. 更新 `PRIVACY.md`
3. 更新 `README.md` 的权限说明
4. 确认 Chrome Web Store 提交材料是否也需要同步

## 页面类型变更时必须做的事

如果新增或移除了支持页面：

1. 更新 `lib/page-detector.js`
2. 更新 `content/modules/detector.js`
3. 更新相应 exporter
4. 更新 `popup/popup.js` 的页面类型展示
5. 更新 `README.md`
6. 更新 `docs/usage.md`

## 发布前建议命令

```bash
node scripts/test-init-scheduler.js
npm run package
```

## 发布前人工检查

- 弹窗能正确识别文章页
- 悬浮球在支持页面正常显示
- 单篇导出可以下载 Markdown
- 图片下载模式可以生成 ZIP
- 问题页 / 首页 / 关注页 / 热榜页能按预期导出
