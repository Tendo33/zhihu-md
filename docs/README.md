# 文档导航

这套文档说明当前代码怎么用、怎么分层、一次点击怎么走完，以及怎么构建和发版。

两边扩展的构建约定相同：`npm run build` 输出 `dist/`，`npm run package` 输出 `build/<名字>-v<版本>.zip`。

推荐阅读顺序：

1. [usage.md](./usage.md)：支持的页面、复制和下载、设置项。
2. [architecture.md](./architecture.md)：当前模块划分。
3. [request-lifecycle.md](./request-lifecycle.md)：从点击到文件落地的链路。
4. [development.md](./development.md)：本地开发、测试、打包和发版。
5. [troubleshooting.md](./troubleshooting.md)：页面失效、导出不全、图片和打包问题。

对应文件：

- 产品说明：[README.md](../README.md)
- 更新日志：[CHANGELOG.md](../CHANGELOG.md)
- 隐私：[PRIVACY.md](../PRIVACY.md)
- 发版清单：[MANIFEST_UPDATE.md](../MANIFEST_UPDATE.md)
