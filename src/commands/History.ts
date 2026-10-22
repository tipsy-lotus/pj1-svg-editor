import type { Command } from './Command.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class History {
  private past: Command[] = [];
  private future: Command[] = [];
  private blocked = true;
  execute(command: Command, document: SvgDocument): string {
    const result = command.execute(document);
    this.past.push(command); this.future = []; this.blocked = false;
    return result;
  }
  barrier(): void { this.past = []; this.future = []; this.blocked = true; }
  undo(document: SvgDocument): string {
    if (this.blocked) throw new Error('undo not allowed after io command');
    const command = this.past.at(-1);
    if (!command) throw new Error('nothing to undo');
    command.undo(document); this.past.pop(); this.future.push(command);
    return `undone: ${command.description}`;
  }
  redo(document: SvgDocument): string {
    if (this.blocked) throw new Error('undo not allowed after io command');
    const command = this.future.at(-1);
    if (!command) throw new Error('nothing to redo');
    command.redo(document); this.future.pop(); this.past.push(command);
    return `redone: ${command.description}`;
  }
}
