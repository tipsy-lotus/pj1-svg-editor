# CLI 重构指标（脚本生成）

基线：final (ce4e37a49d1d3527ea680358810e37cb99f7b654)
目标：HEAD (a8373116e6c3ffd480d0e498da20b656654e9d7d)

当前是阶段快照；收尾必须用 final 与 p2 再生成。统计来自已提交的 Git 快照，不包含工作区未提交内容。

| 分类 | 基线文件 / 行数 / CC | 目标文件 / 行数 / CC | 行数增量 | CC 增量 |
| --- | --- | --- | --- | --- |
| kernel | 33 / 987 / 403 | 46 / 1150 / 436 | 163 | 33 |
| assembly | 1 / 16 / 5 | 6 / 241 / 107 | 225 | 102 |
| plugins | 0 / 0 / 0 | 4 / 144 / 61 | 144 | 61 |
| vscode | 0 / 0 / 0 | 6 / 158 / 37 | 158 | 37 |
| CLI 合计（不含 VSCode） | 34 / 1003 / 408 | 56 / 1535 / 604 | 532 | 196 |

kernel=内核，assembly=装配处，plugins=CLI 插件；vscode 单独列出，不计入 CLI 重构增量。

口径：物理行数包含空行、注释和声明。CC 为实现函数的 1 + 分支数之和，嵌套函数单独计算；存在顶层分支时将顶层作为独立单元加入。分支包括 if、循环、catch、非 default case、三元表达式、&&、||、?? 及对应逻辑赋值。类型节点跳过；可选链、默认参数、default、普通 try 和 finally 不增加 CC。接口签名无函数体，不计函数 CC。

AST 解析器固定为 typescript-analysis（TypeScript 6.0.3），与项目 TypeScript 7 编译器分开；这是明确口径下的静态指标，不代表测试覆盖率或代码质量评分。

范围：src、plugins 与单列的 vscode-extension 中的 TypeScript；排除测试、依赖、构建产物及缓存。插件中业务逻辑迁移会使内核减少、插件增加，应结合总量及逐文件明细解读。

## 目标文件清单与职责

| 文件 | 分类 | 模块职责 | 行数 | CC |
| --- | --- | --- | --- | --- |
| plugins/builtin-commands/src/BuiltinCommandsPlugin.ts | plugins | 插件包 builtin-commands | 75 | 36 |
| plugins/builtin-commands/src/RegisteredCommand.ts | plugins | 插件包 builtin-commands | 13 | 2 |
| plugins/builtin-shapes/src/BuiltinShapeProvider.ts | plugins | 插件包 builtin-shapes | 32 | 15 |
| plugins/builtin-shapes/src/BuiltinShapesPlugin.ts | plugins | 插件包 builtin-shapes | 24 | 8 |
| src/application/EditorSession.ts | kernel | 文档会话 | 58 | 18 |
| src/cli/CommandDispatcher.ts | kernel | 分词、分派与结构展示 | 66 | 34 |
| src/cli/Repl.ts | kernel | 分词、分派与结构展示 | 25 | 10 |
| src/cli/ShapeFormatter.ts | kernel | 分词、分派与结构展示 | 41 | 19 |
| src/cli/Token.ts | kernel | 分词、分派与结构展示 | 3 | 1 |
| src/cli/Tokenizer.ts | kernel | 分词、分派与结构展示 | 35 | 19 |
| src/commands/AddToCommand.ts | kernel | 可撤销编辑事务与历史 | 9 | 2 |
| src/commands/Command.ts | kernel | 可撤销编辑事务与历史 | 7 | 0 |
| src/commands/CreateCommand.ts | kernel | 可撤销编辑事务与历史 | 15 | 3 |
| src/commands/DeleteCommand.ts | kernel | 可撤销编辑事务与历史 | 7 | 2 |
| src/commands/EditCommand.ts | kernel | 可撤销编辑事务与历史 | 27 | 7 |
| src/commands/GroupCommand.ts | kernel | 可撤销编辑事务与历史 | 7 | 2 |
| src/commands/History.ts | kernel | 可撤销编辑事务与历史 | 27 | 8 |
| src/commands/MoveCommand.ts | kernel | 可撤销编辑事务与历史 | 10 | 2 |
| src/commands/ReorderCommand.ts | kernel | 可撤销编辑事务与历史 | 9 | 4 |
| src/commands/ScaleCommand.ts | kernel | 可撤销编辑事务与历史 | 10 | 2 |
| src/commands/SetCommand.ts | kernel | 可撤销编辑事务与历史 | 11 | 2 |
| src/commands/UngroupCommand.ts | kernel | 可撤销编辑事务与历史 | 7 | 2 |
| src/extensions/AttributeContext.ts | kernel | 公开扩展契约与注册表 | 8 | 0 |
| src/extensions/AttributeHandler.ts | kernel | 公开扩展契约与注册表 | 10 | 0 |
| src/extensions/AttributeRegistry.ts | kernel | 公开扩展契约与注册表 | 32 | 17 |
| src/extensions/Command.ts | kernel | 公开扩展契约与注册表 | 10 | 0 |
| src/extensions/CommandContext.ts | kernel | 公开扩展契约与注册表 | 16 | 0 |
| src/extensions/EditorAccess.ts | kernel | 公开扩展契约与注册表 | 16 | 0 |
| src/extensions/Plugin.ts | kernel | 公开扩展契约与注册表 | 5 | 0 |
| src/extensions/PluginContext.ts | kernel | 公开扩展契约与注册表 | 10 | 0 |
| src/extensions/ShapeProvider.ts | kernel | 公开扩展契约与注册表 | 14 | 0 |
| src/extensions/SvgShapeSource.ts | kernel | 公开扩展契约与注册表 | 10 | 0 |
| src/extensions/TreeContext.ts | kernel | 公开扩展契约与注册表 | 10 | 0 |
| src/extensions/TreeDecorator.ts | kernel | 公开扩展契约与注册表 | 7 | 0 |
| src/extensions/TreeDecoratorRegistry.ts | kernel | 公开扩展契约与注册表 | 26 | 16 |
| src/host/DefaultDispatcher.ts | assembly | 装配、激活事务与模块加载 | 13 | 1 |
| src/host/DefaultShapes.ts | assembly | 装配、激活事务与模块加载 | 10 | 2 |
| src/host/PluginHost.ts | assembly | 装配、激活事务与模块加载 | 88 | 49 |
| src/host/PluginLoader.ts | assembly | 装配、激活事务与模块加载 | 83 | 44 |
| src/host/PluginManifest.ts | assembly | 装配、激活事务与模块加载 | 9 | 0 |
| src/io/FileStore.ts | kernel | SVG 编解码与文件访问 | 4 | 0 |
| src/io/NodeFileStore.ts | kernel | SVG 编解码与文件访问 | 33 | 6 |
| src/io/SvgCodec.ts | kernel | SVG 编解码与文件访问 | 171 | 78 |
| src/io/SvgFileRepository.ts | kernel | SVG 编解码与文件访问 | 15 | 3 |
| src/io/XmlSyntax.ts | kernel | SVG 编解码与文件访问 | 31 | 14 |
| src/main.ts | assembly | CLI 启动组合根 | 38 | 11 |
| src/model/Circle.ts | kernel | 图形、容器、文档与图形注册 | 6 | 2 |
| src/model/Ellipse.ts | kernel | 图形、容器、文档与图形注册 | 6 | 2 |
| src/model/Group.ts | kernel | 图形、容器、文档与图形注册 | 36 | 21 |
| src/model/Line.ts | kernel | 图形、容器、文档与图形注册 | 6 | 2 |
| src/model/Rect.ts | kernel | 图形、容器、文档与图形注册 | 6 | 2 |
| src/model/Shape.ts | kernel | 图形、容器、文档与图形注册 | 80 | 36 |
| src/model/ShapeFactory.ts | kernel | 图形、容器、文档与图形注册 | 51 | 26 |
| src/model/SvgDocument.ts | kernel | 图形、容器、文档与图形注册 | 121 | 58 |
| src/model/Text.ts | kernel | 图形、容器、文档与图形注册 | 7 | 3 |
| src/model/Value.ts | kernel | 图形、容器、文档与图形注册 | 29 | 13 |
| vscode-extension/src/extension.ts | vscode | VSCode 文件标记与大纲 | 32 | 5 |
| vscode-extension/src/OutlineElement.ts | vscode | VSCode 文件标记与大纲 | 18 | 5 |
| vscode-extension/src/sax.d.ts | vscode | VSCode 文件标记与大纲 | 17 | 0 |
| vscode-extension/src/SvgDocumentSymbolProvider.ts | vscode | VSCode 文件标记与大纲 | 23 | 6 |
| vscode-extension/src/SvgFileDecorationProvider.ts | vscode | VSCode 文件标记与大纲 | 34 | 11 |
| vscode-extension/src/SvgOutlineParser.ts | vscode | VSCode 文件标记与大纲 | 34 | 10 |

逐函数行号、复杂度、基线文件明细和静态导入列表见 metrics.json。

静态依赖检查：内核不得导入 plugins 或 src/host，插件不得导入 src/host；当前快照无违反项。这里只检查 AST 静态 import/export，动态加载器仍需人工核对，不能据此宣称全部依赖契约已经验收。
