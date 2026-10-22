import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';
export class ScaleCommand extends EditCommand {
  readonly description: string;
  constructor(private readonly id: string, private readonly factor: number) { super(); this.description = `scale ${id}`; }
  protected apply(document: SvgDocument): string {
    const shape = document.find(this.id); shape.scale(this.factor);
    return `${shape.label} scaled by ${this.factor}`;
  }
}
