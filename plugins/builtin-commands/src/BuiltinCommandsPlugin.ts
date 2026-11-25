import { AddToCommand } from '../../../src/commands/AddToCommand.js';
import { CreateCommand } from '../../../src/commands/CreateCommand.js';
import { DeleteCommand } from '../../../src/commands/DeleteCommand.js';
import { GroupCommand } from '../../../src/commands/GroupCommand.js';
import { MoveCommand } from '../../../src/commands/MoveCommand.js';
import { ReorderCommand } from '../../../src/commands/ReorderCommand.js';
import { ScaleCommand } from '../../../src/commands/ScaleCommand.js';
import { SetCommand } from '../../../src/commands/SetCommand.js';
import { UngroupCommand } from '../../../src/commands/UngroupCommand.js';
import { Value } from '../../../src/model/Value.js';
import type { Token } from '../../../src/cli/Token.js';
import type { CommandContext } from '../../../src/extensions/CommandContext.js';
import { RegisteredCommand } from './RegisteredCommand.js';

export class BuiltinCommandsPlugin {
  activate(context: CommandContext): void {
    const session = context.session;
    const define = (name: string, syntax: string, minimum: number, maximum: number, operation: (args: readonly Token[]) => string | readonly string[]): void => {
      context.registerCommand(new RegisteredCommand(name, syntax, minimum, maximum, operation));
    };
    define('init', 'init [w] [h]', 0, 2, args => session.init(
      args[0] ? Value.number(args[0].value) : 800, args[1] ? Value.number(args[1].value) : 600,
    ));
    define('read', 'read <file.svg>', 1, 1, args => session.read(args[0]!.value));
    define('save', 'save [file.svg]', 0, 1, args => session.save(args[0]?.value));
    define('canvas', 'canvas [w h]', 0, 2, args => {
      if (args.length === 1) throw new Error('usage: canvas [w h]');
      return args.length ? session.canvas(Value.number(args[0]!.value), Value.number(args[1]!.value)) : session.canvas();
    });
    define('create', 'create <type> <id> [params...] [in <containerId>]', 2, Infinity, args => this.create(context, args));
    define('delete', 'delete <id>', 1, 1, args => session.execute(new DeleteCommand(args[0]!.value)));
    define('move', 'move <id> <dx> <dy>', 3, 3, args => session.execute(new MoveCommand(
      args[0]!.value, Value.number(args[1]!.value), Value.number(args[2]!.value),
    )));
    define('scale', 'scale <id> <factor>', 2, 2, args => session.execute(new ScaleCommand(args[0]!.value, Value.number(args[1]!.value))));
    define('set', 'set <id> <attr> <value>', 3, 3, args => session.execute(new SetCommand(args[0]!.value, args[1]!.value, args[2]!.value, context.attributes)));
    define('group', 'group <newGid> <id1> [id2...]', 2, Infinity, args => session.execute(new GroupCommand(args[0]!.value, args.slice(1).map(token => token.value))));
    define('ungroup', 'ungroup <gid>', 1, 1, args => session.execute(new UngroupCommand(args[0]!.value)));
    define('addto', 'addto <gid> <id>', 2, 2, args => session.execute(new AddToCommand(args[0]!.value, args[1]!.value)));
    define('front', 'front <id>', 1, 1, args => session.execute(new ReorderCommand(args[0]!.value, true)));
    define('back', 'back <id>', 1, 1, args => session.execute(new ReorderCommand(args[0]!.value, false)));
    define('tree', 'tree [id]', 0, 1, args => context.tree(session.document, args[0]?.value));
    define('show', 'show <id>', 1, 1, args => context.show(session.document, args[0]!.value));
    define('undo', 'undo', 0, 0, () => session.undo());
    define('redo', 'redo', 0, 0, () => session.redo());
    define('help', 'help', 0, 0, () => this.help(context));
    define('quit', 'quit', 0, 0, () => { context.close(); return 'bye'; });
    define('exit', 'exit', 0, 0, () => { context.close(); return 'bye'; });
  }

  private create(context: CommandContext, args: readonly Token[]): string {
    const parameters = args.slice(2);
    const suffix = parameters.at(-2);
    let parent: string | undefined;
    if (suffix?.value === 'in' && !suffix.quoted) {
      parent = parameters.at(-1)!.value;
      parameters.splice(-2);
    } else if (parameters.at(-1)?.value === 'in' && !parameters.at(-1)!.quoted) {
      throw new Error('usage: create <type> <id> [params...] [in <containerId>]');
    }
    return context.session.execute(new CreateCommand(context.shapes, args[0]!.value, args[1]!.value, parameters.map(token => token.value), parent));
  }

  private help(context: CommandContext): readonly string[] {
    return [
      ...context.commands().map(command => command.syntax),
      '', 'Shape parameters:',
      ...context.shapes.help,
      'All create commands accept [in <containerId>]. Use double quotes for spaces.',
      'Only whole lines starting with # are comments. EOF, quit or exit closes the editor.',
    ];
  }
}

export default new BuiltinCommandsPlugin();
