import type { Plugin } from '../../../src/extensions/Plugin.js';
import type { PluginContext } from '../../../src/extensions/PluginContext.js';
import { BoxProvider } from './BoxProvider.js';
import { BoxAttributes } from './BoxAttributes.js';
import { BoxTypeDecorator } from './BoxTypeDecorator.js';

export class BoxPlugin implements Plugin {
  activate(context: Pick<PluginContext, 'registerShape' | 'registerAttribute' | 'registerDecorator'>): void {
    context.registerShape(new BoxProvider());
    context.registerAttribute(new BoxAttributes());
    context.registerDecorator(new BoxTypeDecorator());
  }
}

export default new BoxPlugin();
