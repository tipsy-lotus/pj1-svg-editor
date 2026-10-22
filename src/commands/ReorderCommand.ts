import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class ReorderCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly front: boolean) { super(); this.description = `${front ? 'front' : 'back'} ${id}`; }
  protected apply(document: SvgDocument): string {
    document.reorder(this.id, this.front); return `${document.find(this.id).label} moved to ${this.front ? 'front' : 'back'}`;
  }
}
