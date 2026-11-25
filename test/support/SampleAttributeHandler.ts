import type { AttributeHandler } from '../../src/extensions/AttributeHandler.js';
import type { AttributeContext } from '../../src/extensions/AttributeContext.js';
import type { Shape } from '../../src/model/Shape.js';

/** 独立测试替身，只通过领域公开方法修改两个子部件。 */
export class SampleAttributeHandler implements AttributeHandler {
  constructor(readonly name = 'sample', private readonly fail = false, private readonly attribute = 'theme') {}
  handles(shape: Shape, attribute: string): boolean { return shape.id === 'group' && attribute === this.attribute; }
  apply(context: AttributeContext, _attribute: string, value: string): string {
    context.shape.children[0]!.set('fill', value);
    if (this.fail) throw new Error('handler failed after first edit');
    context.shape.children[1]!.set('fill', value);
    return 'theme applied';
  }
}
