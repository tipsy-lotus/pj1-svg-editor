import type { ShapeProvider } from '../../../src/extensions/ShapeProvider.js';
import type { SvgShapeSource } from '../../../src/extensions/SvgShapeSource.js';
import type { Shape } from '../../../src/model/Shape.js';

export class BuiltinShapeProvider implements ShapeProvider {
  readonly svgPriority = 0;
  constructor(
    readonly name: string,
    readonly help: string,
    private readonly make: (id: string) => Shape,
    private readonly fields: readonly string[],
    private readonly optional?: string,
  ) {}
  create(id: string, params: readonly string[]): Shape {
    if (params.length < this.fields.length || params.length > this.fields.length + (this.optional ? 1 : 0)) {
      throw new Error(`usage: create ${this.name} <id> ${this.fields.map(field => `<${field}>`).join(' ')}${this.optional ? ` [${this.optional}]` : ''} [in <containerId>]`);
    }
    const shape = this.make(id);
    this.fields.forEach((field, index) => shape.set(field, params[index]!));
    if (this.optional && params[this.fields.length] !== undefined) shape.set(this.optional, params[this.fields.length]!);
    return shape;
  }
  matchesSvg(tag: string, _attributes: Readonly<Record<string, string>>): boolean { return tag === this.name; }
  read(source: SvgShapeSource): Shape {
    const shape = this.make(source.id);
    shape.importAttributes(source.attributes);
    source.children.forEach(child => shape.add(child));
    if (shape.supportsText) shape.set('text', source.text);
    else if (source.text.trim()) throw new Error(`invalid SVG: unexpected text in <${source.tag}>`);
    return shape;
  }
}
