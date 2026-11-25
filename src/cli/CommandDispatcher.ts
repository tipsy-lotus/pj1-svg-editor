import type { Command } from '../extensions/Command.js';
import type { CommandContext } from '../extensions/CommandContext.js';
import type { EditorAccess } from '../extensions/EditorAccess.js';
import type { ShapeFactory } from '../model/ShapeFactory.js';
import { ShapeFormatter } from './ShapeFormatter.js';
import { Tokenizer } from './Tokenizer.js';
import { AttributeRegistry } from '../extensions/AttributeRegistry.js';

export class CommandDispatcher {
  private readonly registered = new Map<string, Command>();
  private readonly tokenizer = new Tokenizer();
  private readonly formatter = new ShapeFormatter();
  private closed = false;
  private errors = false;
  readonly context: CommandContext;

  constructor(session: EditorAccess, shapes: ShapeFactory, attributes = new AttributeRegistry()) {
    this.context = {
      session, shapes, attributes,
      registerCommand: command => this.register(command),
      commands: () => [...this.registered.values()],
      tree: (document, id) => this.formatter.tree(document, id),
      show: (document, id) => this.formatter.show(document, id),
      close: () => { this.closed = true; },
    };
  }

  register(command: Command): void {
    if (this.registered.has(command.name)) throw new Error(`duplicate registration: commands/${command.name}`);
    if (!command.name || !command.syntax || !Number.isInteger(command.minimum) || command.minimum < 0
      || (command.maximum !== Infinity && !Number.isInteger(command.maximum))
      || command.maximum < command.minimum || typeof command.run !== 'function') {
      throw new Error('invalid command');
    }
    this.registered.set(command.name, command);
  }

  get stopped(): boolean { return this.closed; }
  get hadErrors(): boolean { return this.errors; }

  execute(line: string): readonly string[] {
    if (this.closed) return [];
    try {
      const tokens = this.tokenizer.parse(line);
      if (!tokens.length) return [];
      const command = this.registered.get(tokens[0]!.value);
      if (!command) throw new Error(`unknown command: ${tokens[0]!.value}`);
      const args = tokens.slice(1);
      if (args.length < command.minimum || args.length > command.maximum) throw new Error(`usage: ${command.syntax}`);
      const result = command.run(args);
      if (typeof result === 'string') return [result];
      if (!Array.isArray(result) || !result.every(item => typeof item === 'string')) throw new Error(`invalid command result: ${command.name}`);
      return result;
    } catch (error) {
      this.errors = true;
      const message = error instanceof Error ? error.message : String(error);
      return [`error: ${message.replace(/[\r\n\t]/g, ' ')}`];
    }
  }
}
