import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
import { AttributeRegistry } from '../extensions/AttributeRegistry.js';
export class SetCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string,
    private readonly attributes = new AttributeRegistry()) { super(); this.description = `set ${id} ${attribute}`; }
  protected apply(document: SvgDocument): string {
    return this.attributes.apply(document, this.id, this.attribute, this.value);
  }
}
