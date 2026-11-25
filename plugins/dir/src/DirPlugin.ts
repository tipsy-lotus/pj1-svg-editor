import type { Plugin } from '../../../src/extensions/Plugin.js';
import type { Command } from '../../../src/extensions/Command.js';
import type { DirectoryAccess } from './DirectoryAccess.js';
import { NodeDirectoryAccess } from './NodeDirectoryAccess.js';
import { DirCommand } from './DirCommand.js';

export class DirPlugin implements Plugin {
  constructor(private readonly directory: DirectoryAccess = new NodeDirectoryAccess()) {}
  activate(context: { registerCommand(command: Command): void }): void {
    context.registerCommand(new DirCommand(this.directory));
  }
}

export default new DirPlugin();
