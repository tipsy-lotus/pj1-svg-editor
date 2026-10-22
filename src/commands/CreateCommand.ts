import { EditCommand } from './EditCommand.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class CreateCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly type: string, private readonly id: string, private readonly params: readonly string[], private readonly parentId?: string) {
    super(); this.description = `create ${type}#${id}`;
  }
  protected apply(document: SvgDocument): string {
    document.assertAvailable(this.id);
    const shape = new ShapeFactory().create(this.type, this.id, this.params);
    document.insert(shape, this.parentId);
    return `${shape.label} created${this.parentId !== undefined ? ` in g#${this.parentId}` : ''}`;
  }
}
