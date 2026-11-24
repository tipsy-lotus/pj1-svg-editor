import { CreateCommand } from '../../src/commands/CreateCommand.js';
import { DefaultShapes } from '../../src/host/DefaultShapes.js';

export class DefaultCreateCommand extends CreateCommand {
  constructor(type: string, id: string, params: readonly string[], parentId?: string) {
    super(new DefaultShapes(), type, id, params, parentId);
  }
}
