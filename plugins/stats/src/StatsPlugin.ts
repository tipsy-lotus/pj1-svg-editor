import type { Plugin } from '../../../src/extensions/Plugin.js';
import type { Command } from '../../../src/extensions/Command.js';
import type { EditorAccess } from '../../../src/extensions/EditorAccess.js';
import { StatsCommand } from './StatsCommand.js';

export class StatsPlugin implements Plugin {
  activate(context: { session: Pick<EditorAccess, 'document'>; registerCommand(command: Command): void }): void {
    context.registerCommand(new StatsCommand(context.session));
  }
}

export default new StatsPlugin();
