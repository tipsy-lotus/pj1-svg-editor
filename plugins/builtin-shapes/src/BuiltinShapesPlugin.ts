import type { ShapeProvider } from '../../../src/extensions/ShapeProvider.js';
import { Rect } from '../../../src/model/Rect.js';
import { Circle } from '../../../src/model/Circle.js';
import { Ellipse } from '../../../src/model/Ellipse.js';
import { Line } from '../../../src/model/Line.js';
import { Text } from '../../../src/model/Text.js';
import { Group } from '../../../src/model/Group.js';
import { BuiltinShapeProvider } from './BuiltinShapeProvider.js';

export class BuiltinShapesPlugin {
  activate(context: { registerShape(provider: ShapeProvider): void }): void {
    const providers = [
      new BuiltinShapeProvider('rect', '  rect <id> <x> <y> <w> <h> [fill]', id => new Rect(id), ['x', 'y', 'width', 'height'], 'fill'),
      new BuiltinShapeProvider('circle', '  circle <id> <cx> <cy> <r> [fill]', id => new Circle(id), ['cx', 'cy', 'r'], 'fill'),
      new BuiltinShapeProvider('ellipse', '  ellipse <id> <cx> <cy> <rx> <ry> [fill]', id => new Ellipse(id), ['cx', 'cy', 'rx', 'ry'], 'fill'),
      new BuiltinShapeProvider('line', '  line <id> <x1> <y1> <x2> <y2> [stroke]', id => new Line(id), ['x1', 'y1', 'x2', 'y2'], 'stroke'),
      new BuiltinShapeProvider('text', '  text <id> <x> <y> "content"', id => new Text(id), ['x', 'y', 'text']),
      new BuiltinShapeProvider('g', '  g <id>', id => new Group(id), []),
    ];
    providers.forEach(provider => context.registerShape(provider));
  }
}

export default new BuiltinShapesPlugin();
