import { CommandDispatcher } from '../cli/CommandDispatcher.js';
import type { EditorAccess } from '../extensions/EditorAccess.js';
import type { ShapeFactory } from '../model/ShapeFactory.js';
import { BuiltinCommandsPlugin } from '../../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { AttributeRegistry } from '../extensions/AttributeRegistry.js';

export class DefaultDispatcher extends CommandDispatcher {
  constructor(session: EditorAccess, shapes: ShapeFactory, attributes = new AttributeRegistry()) {
    super(session, shapes, attributes);
    new BuiltinCommandsPlugin().activate(this.context);
  }
}
