import type { Shape } from '../model/Shape.js';
import type { SvgShapeSource } from './SvgShapeSource.js';

export interface ShapeProvider {
  readonly name: string;
  readonly help: string;
  /** 读回取最高优先级，最高优先级并列则拒绝。 */
  readonly svgPriority: number;
  create(id: string, parameters: readonly string[]): Shape;
  /** 只判断标签和属性，不修改领域对象。 */
  matchesSvg(tag: string, attributes: Readonly<Record<string, string>>): boolean;
  /** 子节点已解析完成。返回结构完整的图形，或抛错。 */
  read(source: SvgShapeSource): Shape;
}
