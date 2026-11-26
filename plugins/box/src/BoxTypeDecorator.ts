import type { TreeDecorator } from '../../../src/extensions/TreeDecorator.js';
import type { TreeContext } from '../../../src/extensions/TreeContext.js';
import { Box } from './Box.js';

export class BoxTypeDecorator implements TreeDecorator {
  readonly name = 'box-type-label';
  decorate(context: TreeContext): string | undefined { return context.shape instanceof Box ? '(box)' : undefined; }
}
