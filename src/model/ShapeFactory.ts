import { Shape } from './Shape.js';
import { Rect } from './Rect.js';
import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Line } from './Line.js';
import { Text } from './Text.js';
import { Group } from './Group.js';

export class ShapeFactory {
  // Phase 1 name-dispatch boundary; replace with providers in the plugin phase.
  private readonly types = new Map<string, { make: (id: string) => Shape; fields: string[]; optional?: string }>([
    ['rect', { make: id => new Rect(id), fields: ['x', 'y', 'width', 'height'], optional: 'fill' }],
    ['circle', { make: id => new Circle(id), fields: ['cx', 'cy', 'r'], optional: 'fill' }],
    ['ellipse', { make: id => new Ellipse(id), fields: ['cx', 'cy', 'rx', 'ry'], optional: 'fill' }],
    ['line', { make: id => new Line(id), fields: ['x1', 'y1', 'x2', 'y2'], optional: 'stroke' }],
    ['text', { make: id => new Text(id), fields: ['x', 'y', 'text'] }],
    ['g', { make: id => new Group(id), fields: [] }],
  ]);
  private definition(type: string) {
    const definition = this.types.get(type);
    if (!definition) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
  create(type: string, id: string, params: readonly string[]): Shape {
    const { make, fields, optional } = this.definition(type);
    if (params.length < fields.length || params.length > fields.length + (optional ? 1 : 0)) {
      throw new Error(`usage: create ${type} <id> ${fields.map(field => `<${field}>`).join(' ')}${optional ? ` [${optional}]` : ''} [in <containerId>]`);
    }
    const shape = make(id);
    fields.forEach((field, index) => shape.set(field, params[index]!));
    if (optional && params[fields.length] !== undefined) shape.set(optional, params[fields.length]!);
    return shape;
  }
  fromAttributes(type: string, id: string, attributes: Readonly<Record<string, string>>): Shape {
    const shape = this.definition(type).make(id);
    shape.importAttributes(attributes);
    return shape;
  }
}
