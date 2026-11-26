import type { AttributeHandler } from '../../../src/extensions/AttributeHandler.js';
import type { AttributeContext } from '../../../src/extensions/AttributeContext.js';
import type { Shape } from '../../../src/model/Shape.js';
import { Box } from './Box.js';

export class BoxAttributes implements AttributeHandler {
  readonly name = 'box-attributes';
  handles(shape: Shape, attribute: string): boolean { return shape instanceof Box && (attribute === 'fill' || attribute === 'label'); }
  apply(context: AttributeContext, attribute: string, value: string): string {
    if (!(context.shape instanceof Box)) throw new Error('box attribute target required');
    if (attribute === 'fill') {
      context.shape.setFill(value);
      return `${context.shape.label} fill propagated to ${context.shape.id}-rect`;
    }
    if (attribute !== 'label') throw new Error(`unknown attribute: ${attribute}`);
    context.shape.setLabel(value);
    return `${context.shape.label} label updated: ${JSON.stringify(value)}`;
  }
}
