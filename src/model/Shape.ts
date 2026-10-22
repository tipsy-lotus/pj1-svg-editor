import { Value } from './Value.js';

export abstract class Shape {
  private readonly values = new Map<string, string>();
  private content = '';
  abstract readonly tag: string;

  protected constructor(
    readonly id: string,
    private readonly geometry: readonly string[],
    private readonly horizontal: readonly string[],
    private readonly vertical: readonly string[],
    private readonly nonnegative: readonly string[] = [],
  ) {
    Value.id(id);
    for (const name of geometry) this.values.set(name, '0');
  }

  get label(): string { return `${this.tag}#${this.id}`; }
  get text(): string { return this.content; }
  get supportsText(): boolean { return this.acceptsText(); }
  get children(): readonly Shape[] { return []; }
  get isContainer(): boolean { return false; }
  get attributes(): Readonly<Record<string, string>> { return Object.fromEntries(this.values); }

  set(name: string, value: string): void {
    if (name === 'text' && this.acceptsText()) {
      this.content = Value.text(value);
      return;
    }
    if (this.geometry.includes(name) || name === 'stroke-width') {
      const number = Value.number(value);
      if ((this.nonnegative.includes(name) || name === 'stroke-width') && number < 0) {
        throw new Error(`${name} must be nonnegative`);
      }
      this.values.set(name, String(number));
      return;
    }
    if (name === 'fill' || name === 'stroke') {
      this.values.set(name, Value.text(value));
      return;
    }
    throw new Error(`unknown attribute: ${name}`);
  }

  /** Preserve additional SVG presentation attributes on import; CLI set stays whitelisted. */
  importAttributes(attributes: Readonly<Record<string, string>>): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'id') continue;
      if (this.geometry.includes(name) || ['fill', 'stroke', 'stroke-width'].includes(name)) this.set(name, value);
      else this.values.set(name, Value.text(value));
    }
  }

  move(dx: number, dy: number): void {
    Value.number(dx); Value.number(dy);
    for (const name of this.horizontal) this.set(name, String(Number(this.values.get(name)) + dx));
    for (const name of this.vertical) this.set(name, String(Number(this.values.get(name)) + dy));
  }

  scale(factor: number): void {
    Value.positive(factor, 'scale factor');
    for (const name of this.geometry) this.set(name, String(Number(this.values.get(name)) * factor));
  }

  add(_child: Shape, _index?: number): void { throw new Error(`not a container: ${this.id}`); }
  remove(_child: Shape): void { throw new Error(`not a container: ${this.id}`); }
  protected acceptsText(): boolean { return false; }
  protected copyTo<T extends Shape>(target: T): T {
    target.importAttributes(this.attributes);
    target.content = this.content;
    return target;
  }
  abstract clone(): Shape;
}
