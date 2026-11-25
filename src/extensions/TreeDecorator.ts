import type { TreeContext } from './TreeContext.js';

export interface TreeDecorator {
  readonly name: string;
  /** 返回行尾标签；空串或 undefined 不显示。不得修改文档。 */
  decorate(context: TreeContext): string | undefined;
}
