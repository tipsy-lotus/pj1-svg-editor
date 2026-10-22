import { EditorSession } from '../application/EditorSession.js';
import { AddToCommand } from '../commands/AddToCommand.js';
import { CreateCommand } from '../commands/CreateCommand.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
import { GroupCommand } from '../commands/GroupCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { ReorderCommand } from '../commands/ReorderCommand.js';
import { ScaleCommand } from '../commands/ScaleCommand.js';
import { SetCommand } from '../commands/SetCommand.js';
import { UngroupCommand } from '../commands/UngroupCommand.js';
import { Value } from '../model/Value.js';
import { ShapeFormatter } from './ShapeFormatter.js';
import type { Token } from './Token.js';
import { Tokenizer } from './Tokenizer.js';

export class CommandDispatcher {
  // Phase 1 的命令名称分派入口；插件阶段改为注册机制。
  private readonly commands = new Map<string, { syntax: string; run: (args: readonly Token[]) => readonly string[] }>();
  private readonly tokenizer = new Tokenizer();
  private readonly formatter = new ShapeFormatter();
  private closed = false;
  private errors = false;

  constructor(private readonly session: EditorSession) {
    this.define('init', 'init [w] [h]', 0, 2, args => session.init(
      args[0] ? Value.number(args[0].value) : 800, args[1] ? Value.number(args[1].value) : 600,
    ));
    this.define('read', 'read <file.svg>', 1, 1, args => session.read(args[0]!.value));
    this.define('save', 'save [file.svg]', 0, 1, args => session.save(args[0]?.value));
    this.define('canvas', 'canvas [w h]', 0, 2, args => {
      if (args.length === 1) throw new Error('usage: canvas [w h]');
      return args.length ? session.canvas(Value.number(args[0]!.value), Value.number(args[1]!.value)) : session.canvas();
    });
    this.define('create', 'create <type> <id> [params...] [in <containerId>]', 2, Infinity, args => this.create(args));
    this.define('delete', 'delete <id>', 1, 1, args => session.execute(new DeleteCommand(args[0]!.value)));
    this.define('move', 'move <id> <dx> <dy>', 3, 3, args => session.execute(new MoveCommand(
      args[0]!.value, Value.number(args[1]!.value), Value.number(args[2]!.value),
    )));
    this.define('scale', 'scale <id> <factor>', 2, 2, args => session.execute(new ScaleCommand(args[0]!.value, Value.number(args[1]!.value))));
    this.define('set', 'set <id> <attr> <value>', 3, 3, args => session.execute(new SetCommand(args[0]!.value, args[1]!.value, args[2]!.value)));
    this.define('group', 'group <newGid> <id1> [id2...]', 2, Infinity, args => session.execute(new GroupCommand(args[0]!.value, args.slice(1).map(token => token.value))));
    this.define('ungroup', 'ungroup <gid>', 1, 1, args => session.execute(new UngroupCommand(args[0]!.value)));
    this.define('addto', 'addto <gid> <id>', 2, 2, args => session.execute(new AddToCommand(args[0]!.value, args[1]!.value)));
    this.define('front', 'front <id>', 1, 1, args => session.execute(new ReorderCommand(args[0]!.value, true)));
    this.define('back', 'back <id>', 1, 1, args => session.execute(new ReorderCommand(args[0]!.value, false)));
    this.define('tree', 'tree [id]', 0, 1, args => this.formatter.tree(session.document, args[0]?.value));
    this.define('show', 'show <id>', 1, 1, args => this.formatter.show(session.document, args[0]!.value));
    this.define('undo', 'undo', 0, 0, () => session.undo());
    this.define('redo', 'redo', 0, 0, () => session.redo());
    this.define('help', 'help', 0, 0, () => this.help());
    this.define('quit', 'quit', 0, 0, () => { this.closed = true; return 'bye'; });
    this.define('exit', 'exit', 0, 0, () => { this.closed = true; return 'bye'; });
  }

  get stopped(): boolean { return this.closed; }
  get hadErrors(): boolean { return this.errors; }

  execute(line: string): readonly string[] {
    if (this.closed) return [];
    try {
      const tokens = this.tokenizer.parse(line);
      if (!tokens.length) return [];
      const command = this.commands.get(tokens[0]!.value);
      if (!command) throw new Error(`unknown command: ${tokens[0]!.value}`);
      return command.run(tokens.slice(1));
    } catch (error) {
      this.errors = true;
      const message = error instanceof Error ? error.message : String(error);
      return [`error: ${message.replace(/[\r\n\t]/g, ' ')}`];
    }
  }

  private define(name: string, syntax: string, minimum: number, maximum: number, operation: (args: readonly Token[]) => string | readonly string[]): void {
    this.commands.set(name, {
      syntax,
      run: args => {
        if (args.length < minimum || args.length > maximum) throw new Error(`usage: ${syntax}`);
        const result = operation(args);
        return typeof result === 'string' ? [result] : result;
      },
    });
  }

  private create(args: readonly Token[]): string {
    const parameters = args.slice(2);
    const suffix = parameters.at(-2);
    let parent: string | undefined;
    if (suffix?.value === 'in' && !suffix.quoted) {
      parent = parameters.at(-1)!.value;
      parameters.splice(-2);
    } else if (parameters.at(-1)?.value === 'in' && !parameters.at(-1)!.quoted) {
      throw new Error('usage: create <type> <id> [params...] [in <containerId>]');
    }
    return this.session.execute(new CreateCommand(args[0]!.value, args[1]!.value, parameters.map(token => token.value), parent));
  }

  private help(): readonly string[] {
    return [
      ...[...this.commands.values()].map(command => command.syntax),
      '', 'Shape parameters:',
      '  rect <id> <x> <y> <w> <h> [fill]', '  circle <id> <cx> <cy> <r> [fill]',
      '  ellipse <id> <cx> <cy> <rx> <ry> [fill]', '  line <id> <x1> <y1> <x2> <y2> [stroke]',
      '  text <id> <x> <y> "content"', '  g <id>',
      'All create commands accept [in <containerId>]. Use double quotes for spaces.',
      'Only whole lines starting with # are comments. EOF, quit or exit closes the editor.',
    ];
  }
}
