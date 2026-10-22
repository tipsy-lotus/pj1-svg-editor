import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class SetCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string) { super(); this.description = `set ${id} ${attribute}`; }
  protected apply(document: SvgDocument): string {
    const shape = document.find(this.id); shape.set(this.attribute, this.value);
    return `${shape.label} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }
}
