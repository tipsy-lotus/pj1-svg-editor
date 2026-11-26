import type { Plugin } from '../../../src/extensions/Plugin.js';
import type { TreeDecorator } from '../../../src/extensions/TreeDecorator.js';
import { ModifiedStar } from './ModifiedStar.js';

export class TreeStarPlugin implements Plugin {
  activate(context: { registerDecorator(decorator: TreeDecorator): void }): void {
    context.registerDecorator(new ModifiedStar());
  }
}

export default new TreeStarPlugin();
