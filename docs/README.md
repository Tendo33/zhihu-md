# 文档导航

这套文档用于把当前代码实现、使用方式和维护流程统一说明清楚。

推荐阅读顺序：

1. [usage.md](./usage.md): 先了解支持哪些页面、怎么导出、设置项怎么影响结果。
2. [architecture.md](./architecture.md): 再看模块划分，理解弹窗、内容脚本、后台脚本如何协作。
3. [request-lifecycle.md](./request-lifecycle.md): 需要定位问题时，顺着完整链路排查最有效。
4. [development.md](./development.md): 做开发、打包、发版时优先参考。
5. [troubleshooting.md](./troubleshooting.md): 出现页面失效、导出不全、图片异常时查这里。

如果你只想快速上手：

- 用户视角先读 [usage.md](./usage.md)
- 开发者视角先读 [development.md](./development.md)

如果你准备修改代码：

- 从 [architecture.md](./architecture.md) 看入口文件和职责边界
- 再配合 [request-lifecycle.md](./request-lifecycle.md) 跟踪一次导出流程

如果你准备发布新版本：

- 先看 [development.md](./development.md) 的发布章节
- 再对照根目录的 [MANIFEST_UPDATE.md](../MANIFEST_UPDATE.md)
