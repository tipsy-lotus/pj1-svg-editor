import type { TreeDecorator } from '../../src/extensions/TreeDecorator.js';
import type { TreeContext } from '../../src/extensions/TreeContext.js';

export class SampleTreeDecorator implements TreeDecorator {
  private visits = 0;
  constructor(readonly name: string, private readonly label: string, private readonly target?: string) {}
  get calls(): number { return this.visits; }
  decorate(context: TreeContext): string | undefined {
    this.visits++;
    return this.target === undefined || context.shape?.id === this.target ? this.label : undefined;
  }
}
