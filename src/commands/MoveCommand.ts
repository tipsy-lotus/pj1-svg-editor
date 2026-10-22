import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class MoveCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly dx: number, private readonly dy: number) { super(); this.description = `move ${id}`; }
  protected apply(document: SvgDocument): string {
    const shape = document.find(this.id); shape.move(this.dx, this.dy);
    return `${shape.label} moved by (${this.dx},${this.dy})`;
  }
}
