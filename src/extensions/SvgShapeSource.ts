import type { Shape } from '../model/Shape.js';

/** 已完成 XML 语法、命名空间、数字规范化和全局 ID 检查的领域输入。 */
export interface SvgShapeSource {
  readonly tag: string;
  readonly id: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly Shape[];
  readonly text: string;
}
