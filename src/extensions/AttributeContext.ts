import type { SvgDocument } from '../model/SvgDocument.js';
import type { Shape } from '../model/Shape.js';

/** 只提供领域操作，不提供保存、历史栈或嵌套命令入口。 */
export interface AttributeContext {
  readonly document: SvgDocument;
  readonly shape: Shape;
}
