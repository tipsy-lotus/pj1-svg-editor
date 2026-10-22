import { Shape } from './Shape.js';
export class Circle extends Shape {
  readonly tag = 'circle';
  constructor(id: string) { super(id, ['cx', 'cy', 'r'], ['cx'], ['cy'], ['r']); }
  clone(): Circle { return this.copyTo(new Circle(this.id)); }
}
