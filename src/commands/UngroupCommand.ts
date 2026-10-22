import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class UngroupCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string) { super(); this.description = `ungroup ${id}`; }
  protected apply(document: SvgDocument): string { document.ungroup(this.id); return `g#${this.id} ungrouped`; }
}
