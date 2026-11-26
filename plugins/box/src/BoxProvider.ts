import type { ShapeProvider } from '../../../src/extensions/ShapeProvider.js';
import type { SvgShapeSource } from '../../../src/extensions/SvgShapeSource.js';
import { Rect } from '../../../src/model/Rect.js';
import { Text } from '../../../src/model/Text.js';
import { Box } from './Box.js';

export class BoxProvider implements ShapeProvider {
  readonly name = 'box';
  readonly help = '  box <id> <x> <y> <w> <h> "label"';
  readonly svgPriority = 100;
  create(id: string, params: readonly string[]): Box {
    if (params.length !== 5) throw new Error('usage: create box <id> <x> <y> <w> <h> "label" [in <containerId>]');
    const rect = new Rect(`${id}-rect`);
    ['x', 'y', 'width', 'height'].forEach((name, index) => rect.set(name, params[index]!));
    rect.set('fill', '#4a90d9');
    const text = new Text(`${id}-label`);
    text.set('x', String(Number(rect.attributes.x) + 20));
    text.set('y', String(Number(rect.attributes.y) + Number(rect.attributes.height) / 2 + 5));
    text.set('text', params[4]!); text.set('fill', 'white');
    return new Box(id, [rect, text]);
  }
  matchesSvg(tag: string, attributes: Readonly<Record<string, string>>): boolean {
    return tag === 'g' && attributes['data-kind'] === 'box';
  }
  read(source: SvgShapeSource): Box {
    if (source.text.trim()) throw new Error(`invalid box structure: ${source.id}`);
    return new Box(source.id, source.children, source.attributes);
  }
}
