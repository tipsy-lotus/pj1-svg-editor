import { ShapeFactory } from '../model/ShapeFactory.js';
import { BuiltinShapesPlugin } from '../../plugins/builtin-shapes/src/BuiltinShapesPlugin.js';

/** 默认能力的组合根；纯 ShapeFactory 自身不认识任何内置类型。 */
export class DefaultShapes extends ShapeFactory {
  constructor() {
    super();
    new BuiltinShapesPlugin().activate({ registerShape: provider => this.register(provider) });
  }
}
