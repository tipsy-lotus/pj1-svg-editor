import type { CommandContext } from './CommandContext.js';
import type { ShapeProvider } from './ShapeProvider.js';
import type { AttributeHandler } from './AttributeHandler.js';
import type { TreeDecorator } from './TreeDecorator.js';

export interface PluginContext extends CommandContext {
  registerShape(provider: ShapeProvider): void;
  registerAttribute(handler: AttributeHandler): void;
  registerDecorator(decorator: TreeDecorator): void;
}
