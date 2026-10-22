import { Shape } from './Shape.js';
export class Text extends Shape {
  readonly tag = 'text';
  constructor(id: string) { super(id, ['x', 'y'], ['x'], ['y']); }
  protected override acceptsText(): boolean { return true; }
  clone(): Text { return this.copyTo(new Text(this.id)); }
}
