import { Shape } from '../../../src/model/Shape.js';
import { Value } from '../../../src/model/Value.js';

export class Diamond extends Shape {
  readonly tag = 'polygon';
  constructor(id: string, cx: number, cy: number, width: number, height: number) {
    super(id, ['cx', 'cy', 'width', 'height'], [], []);
    this.assign(cx, cy, width, height);
  }
  override get label(): string { return `diamond#${this.id}`; }
  override get attributes(): Readonly<Record<string, string>> {
    const { cx, cy, width, height, ...style } = super.attributes;
    return { ...style, 'data-kind': 'diamond', 'data-cx': cx!, 'data-cy': cy!,
      'data-width': width!, 'data-height': height!, points: this.points(Number(cx), Number(cy), Number(width), Number(height)) };
  }
  override set(name: string, value: string): void {
    if (!['cx', 'cy', 'width', 'height'].includes(name)) { super.set(name, value); return; }
    const geometry = { ...super.attributes, [name]: String(Value.number(value)) };
    this.assign(Number(geometry.cx), Number(geometry.cy), Number(geometry.width), Number(geometry.height));
  }
  override move(dx: number, dy: number): void {
    const geometry = super.attributes;
    this.assign(Number(geometry.cx) + Value.number(dx), Number(geometry.cy) + Value.number(dy), Number(geometry.width), Number(geometry.height));
  }
  override scale(factor: number): void {
    Value.positive(factor, 'scale factor'); const geometry = super.attributes;
    this.assign(Number(geometry.cx) * factor, Number(geometry.cy) * factor, Number(geometry.width) * factor, Number(geometry.height) * factor);
  }
  clone(): Diamond {
    const geometry = super.attributes;
    return this.copyTo(new Diamond(this.id, Number(geometry.cx), Number(geometry.cy), Number(geometry.width), Number(geometry.height)));
  }
  private assign(cx: number, cy: number, width: number, height: number): void {
    Value.number(cx); Value.number(cy); Value.positive(width, 'diamond width'); Value.positive(height, 'diamond height');
    this.points(cx, cy, width, height); // 全部验证成功后再写入，避免局部溢出。
    for (const [name, value] of Object.entries({ cx, cy, width, height })) super.set(name, String(value));
  }
  private points(cx: number, cy: number, width: number, height: number): string {
    return [cx, cy - height / 2, cx + width / 2, cy, cx, cy + height / 2, cx - width / 2, cy]
      .map(value => String(Value.number(value))).join(' ');
  }
}
