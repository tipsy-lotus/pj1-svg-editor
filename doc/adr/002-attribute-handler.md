# ADR 002：属性处理器与编辑事务

状态：接口、注册表与 set 调用链已实现；实际 box 属性插件待接入。

## 决策

- `AttributeHandler` 以类实例注册，具有稳定名称、`handles(shape, attribute)` 和 `apply(context, attribute, value)`。
- `handles` 是纯判断，不能修改对象或跨命令缓存可变图形引用。每次执行根据当前文档重新定位图形，避免 undo 恢复快照后使用失效引用。
- `AttributeContext` 提供当前文档和目标图形。处理器通过公开领域方法查找、修改子部件，不读取私有字段；不提供保存、嵌套执行命令或操作历史栈的入口。
- 按注册顺序检查全部处理器。零命中则调用原有 `Shape.set`，保留 Phase 1 白名单与错误信息；一个命中则调用该处理器；多个命中则拒绝执行，错误中按注册顺序列出冲突名称。不按顺序覆盖或组合处理。
- 处理器可返回成功信息；返回 undefined 时使用原有通用提示。抛错和非法返回值直接向上传递，不能再次尝试默认属性处理。

## 事务与失败恢复

注册表在 `SetCommand.apply` 中调用，外层 `EditCommand.execute` 先保存整份文档快照。一个处理器修改多个子部件仍只提交一次成功命令，undo 和 redo 分别恢复该命令的前后快照，不重新调用处理器。

定位、判断或应用阶段发生异常时，外层恢复执行前的文档，`History.execute` 不加入 past，也不清空 future，因此原有撤销和重做记录保持。处理器不得访问文件系统、修改外部状态或启动异步修改：文档快照不能回滚这些副作用。

同名注册报 `duplicate registration: attributes/<name>`；非法处理器报 `invalid attribute handler`；多命中报 `conflicting attribute handlers: <attr> (<names>)`。只读判断和无外部副作用属于插件契约，不声称能在运行时拦截任意插件代码。

## 验证

`test/attribute-extension.test.ts` 通过独立类替身验证缺省白名单、复合修改的一次撤销/重做、部分修改后失败的整体恢复、失败不回退到默认 fill、冲突拒绝、重复注册和判断阶段抛错。调用通过真实 CLI set 链路执行，另有直接事务测试。

当前默认没有属性处理器，原有行为不变；测试替身不作为最终要求的 box 插件交付。box 的 fill、label 处理器以及加载器对注册项的整包回滚将在后续步骤实现。
