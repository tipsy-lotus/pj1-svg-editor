import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class GroupCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly members: readonly string[]) { super(); this.description = `group ${id}`; }
  protected apply(document: SvgDocument): string { return `${document.group(this.id, this.members).label} created with ${this.members.length} children`; }
}
