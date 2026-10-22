import { Shape } from './Shape.js';
export class Ellipse extends Shape {
  readonly tag = 'ellipse';
  constructor(id: string) { super(id, ['cx', 'cy', 'rx', 'ry'], ['cx'], ['cy'], ['rx', 'ry']); }
  clone(): Ellipse { return this.copyTo(new Ellipse(this.id)); }
}
