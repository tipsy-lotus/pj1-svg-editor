import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class DeleteCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string) { super(); this.description = `delete ${id}`; }
  protected apply(document: SvgDocument): string { return `${document.delete(this.id).label} deleted`; }
}
