import { Shape } from './Shape.js';
export class Line extends Shape {
  readonly tag = 'line';
  constructor(id: string) { super(id, ['x1', 'y1', 'x2', 'y2'], ['x1', 'x2'], ['y1', 'y2']); }
  clone(): Line { return this.copyTo(new Line(this.id)); }
}
