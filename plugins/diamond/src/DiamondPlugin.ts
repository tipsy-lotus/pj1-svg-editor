import type { Plugin } from '../../../src/extensions/Plugin.js';
import type { ShapeProvider } from '../../../src/extensions/ShapeProvider.js';
import { DiamondProvider } from './DiamondProvider.js';

export class DiamondPlugin implements Plugin {
  activate(context: { registerShape(provider: ShapeProvider): void }): void { context.registerShape(new DiamondProvider()); }
}

export default new DiamondPlugin();
