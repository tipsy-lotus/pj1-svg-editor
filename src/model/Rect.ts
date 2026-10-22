import { Shape } from './Shape.js';
export class Rect extends Shape {
  readonly tag = 'rect';
  constructor(id: string) { super(id, ['x', 'y', 'width', 'height'], ['x'], ['y'], ['width', 'height']); }
  clone(): Rect { return this.copyTo(new Rect(this.id)); }
}
