import { CommandDispatcher } from '../cli/CommandDispatcher.js';
import type { EditorAccess } from '../extensions/EditorAccess.js';
import type { ShapeFactory } from '../model/ShapeFactory.js';
import { BuiltinCommandsPlugin } from '../../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';

export class DefaultDispatcher extends CommandDispatcher {
  constructor(session: EditorAccess, shapes: ShapeFactory) {
    super(session, shapes);
    new BuiltinCommandsPlugin().activate(this.context);
  }
}
