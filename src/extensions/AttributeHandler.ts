import type { Shape } from '../model/Shape.js';
import type { AttributeContext } from './AttributeContext.js';

export interface AttributeHandler {
  readonly name: string;
  /** 只读判断；不得修改文档或保存可变图形引用以供后续命令使用。 */
  handles(shape: Shape, attribute: string): boolean;
  /** 在外层 SetCommand 的事务中调用；可返回自定义成功信息。 */
  apply(context: AttributeContext, attribute: string, value: string): string | void;
}
