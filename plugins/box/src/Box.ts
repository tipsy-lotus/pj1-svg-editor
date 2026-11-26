import { Group } from '../../../src/model/Group.js';
import { Rect } from '../../../src/model/Rect.js';
import { Text } from '../../../src/model/Text.js';
import type { Shape } from '../../../src/model/Shape.js';

export class Box extends Group {
  constructor(id: string, children: readonly Shape[], attributes: Readonly<Record<string, string>> = {}) {
    super(id);
    const rectangles = children.filter(child => child.id === `${id}-rect`);
    const labels = children.filter(child => child.id === `${id}-label`);
    if (rectangles.length !== 1 || !(rectangles[0] instanceof Rect)
      || labels.length !== 1 || !(labels[0] instanceof Text)) throw new Error(`invalid box structure: ${id}`);
    this.importAttributes({ ...attributes, 'data-kind': 'box' });
    children.forEach(child => super.add(child));
  }
  override get label(): string { return `box#${this.id}`; }
  override get treeLabel(): string { return `g#${this.id}`; }
  override get creationMessage(): string { return `${this.label} created (g#${this.id} + rect#${this.id}-rect + text#${this.id}-label)`; }
  setFill(value: string): void { this.children.find(child => child.id === `${this.id}-rect`)!.set('fill', value); }
  setLabel(value: string): void { this.children.find(child => child.id === `${this.id}-label`)!.set('text', value); }
  override assertCanRemove(child: Shape): void {
    if (child.id === `${this.id}-rect` || child.id === `${this.id}-label`) throw new Error(`cannot remove required box part: ${child.id}`);
  }
  override assertCanUngroup(): void { throw new Error(`cannot ungroup composite shape: ${this.id}`); }
  override clone(): Box { return new Box(this.id, this.children.map(child => child.clone()), this.attributes); }
}
