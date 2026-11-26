import type { TreeDecorator } from '../../../src/extensions/TreeDecorator.js';
import type { TreeContext } from '../../../src/extensions/TreeContext.js';
import type { SvgDocument } from '../../../src/model/SvgDocument.js';
import type { Shape } from '../../../src/model/Shape.js';

/** 保存内容比较，不依赖具体图形类型或其他标签。 */
export class ModifiedStar implements TreeDecorator {
  readonly name = 'modified-star';
  private readonly modifiedIds = new Set<string>();
  private rootModified = false;

  decorate(context: TreeContext): string | undefined {
    // 不按对象引用缓存：编辑和撤销都可能改变同一文档的内容。
    const current = this.capture(context.document);
    const saved = context.savedDocument ? this.capture(context.savedDocument) : undefined;
    this.modifiedIds.clear();
    for (const [id, value] of current.shapes) if (value !== saved?.shapes.get(id)) this.modifiedIds.add(id);
    this.rootModified = current.root !== saved?.root;
    return (context.shape ? this.modifiedIds.has(context.shape.id) : this.rootModified) ? '*' : undefined;
  }

  private attributes(values: Readonly<Record<string, string>>): readonly (readonly [string, string])[] {
    return Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  }
  private capture(document: SvgDocument): { root: string; shapes: Map<string, string> } {
    const shapes = new Map<string, string>();
    const visit = (shape: Shape, parent: string | undefined, index: number): unknown => {
      const content = [shape.id, shape.tag, shape.isContainer, this.attributes(shape.attributes), shape.text,
        shape.children.map((child, position) => visit(child, shape.id, position))];
      // 父级和同级顺序也属于节点的结构位置变化。
      shapes.set(shape.id, JSON.stringify([parent, index, content]));
      return content;
    };
    const children = document.children.map((shape, index) => visit(shape, undefined, index));
    return { root: JSON.stringify([document.width, document.height, this.attributes(document.attributes), children]), shapes };
  }
}
