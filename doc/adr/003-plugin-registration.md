# ADR 003：插件清单校验与整包注册事务

状态：宿主注册事务已实现，配置文件和动态模块加载待实现。

## 决策

`Plugin` 与 `PluginContext` 定义在内核接口侧。`PluginHost` 放在宿主侧，不导入具体插件；`main.ts` 是代码装配入口，显式选择内置插件，并读取各自 package.json 的 contributes 清单。

每次激活先建立包含已有注册项的影子注册表，四种 register 方法只写入暂存区。激活完成（包括异步激活）后，按 shapes、commands、attributes、decorators 四类分别比较声明与实际注册的名称集合；省略类别按空集合处理，数组顺序不影响校验，声明中重复名称或额外类别拒绝。比较通过后才统一发布，任何发布阶段异常恢复四份注册表检查点。

插件可调用公开领域服务，但不能通过上下文直接取得注册表的 register 或 checkpoint；应使用统一的 registerShape、registerCommand、registerAttribute、registerDecorator。运行期闭包使用正式注册表，因此 help 能看到提交后的全部贡献，而不是暂存副本。

同类名称重复时立即报 `error: duplicate registration: <category>/<name>`。即使插件捕获该异常，宿主也记住注册失败，不提交其余贡献。清单不符报 `error: plugin manifest mismatch: <name> (declared: …, registered: …)`，激活异常报 `error: plugin failed to activate: <name> (<reason>)`。宿主返回诊断，调用方可继续加载后续插件。

加载请求按调用顺序串行执行。激活结束后上下文的注册入口关闭，禁止定时器等异步任务追加注册。options 不做隐式改写，原样传给 activate；具体选项由插件校验。

## 边界

事务只覆盖注册表，不是任意第三方代码的安全沙箱。激活阶段应只注册功能，不编辑文档、写文件或产生不可撤销外部副作用。注册元数据应稳定，不得在激活后改名或使用会变化的 getter。已成功插件及其实例不因后续失败而重新创建。

目前 DefaultShapes 和 DefaultDispatcher 仍作为测试与早期默认装配的便利类保留；真实 CLI main 已通过 PluginHost 激活两个内置插件。后续配置方式必须复用 PluginHost.activate，不再创建第二条注册与校验路径。

## 验证

`test/plugin-host.test.ts` 覆盖四类暂存与发布、options、清单不符、同包/跨包重名、插件吞掉注册错误、异步抛错、后续加载、上下文关闭、内置清单和并发串行。真实 CLI 回放继续对照 final，输出及生成 SVG 字节一致。

模块解析、默认导出检查、配置结构校验不属于此步骤，尚不能据此宣称配置加载器全部验收通过。
