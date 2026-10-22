import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class AddToCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly groupId: string, private readonly id: string) { super(); this.description = `addto ${groupId} ${id}`; }
  protected apply(document: SvgDocument): string {
    document.addTo(this.groupId, this.id); return `${document.find(this.id).label} added to g#${this.groupId}`;
  }
}
