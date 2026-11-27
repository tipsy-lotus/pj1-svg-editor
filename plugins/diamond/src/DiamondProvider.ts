import type { ShapeProvider } from '../../../src/extensions/ShapeProvider.js';
import type { SvgShapeSource } from '../../../src/extensions/SvgShapeSource.js';
import { Value } from '../../../src/model/Value.js';
import { Diamond } from './Diamond.js';

export class DiamondProvider implements ShapeProvider {
  readonly name = 'diamond';
  readonly help = '  diamond <id> <cx> <cy> <w> <h> [fill]';
  readonly svgPriority = 100;
  create(id: string, params: readonly string[]): Diamond {
    if (params.length < 4 || params.length > 5) throw new Error('usage: create diamond <id> <cx> <cy> <w> <h> [fill] [in <containerId>]');
    const shape = new Diamond(id, Value.number(params[0]!), Value.number(params[1]!), Value.number(params[2]!), Value.number(params[3]!));
    if (params[4] !== undefined) shape.set('fill', params[4]);
    return shape;
  }
  matchesSvg(tag: string, attributes: Readonly<Record<string, string>>): boolean {
    return tag === 'polygon' && attributes['data-kind'] === 'diamond';
  }
  read(source: SvgShapeSource): Diamond {
    try {
      if (source.children.length || source.text.trim()) throw new Error('not a leaf');
      const attrs = source.attributes;
      if (['cx', 'cy', 'width', 'height'].some(name => Object.hasOwn(attrs, name))) throw new Error('ambiguous geometry');
      const shape = new Diamond(source.id, Value.number(attrs['data-cx']!), Value.number(attrs['data-cy']!),
        Value.number(attrs['data-width']!), Value.number(attrs['data-height']!));
      const points = (attrs.points ?? '').trim().split(/[\s,]+/).map(value => String(Value.number(value))).join(' ');
      if (points !== shape.attributes.points) throw new Error('points mismatch');
      shape.importAttributes(attrs);
      return shape;
    } catch { throw new Error(`invalid diamond structure: ${source.id}`); }
  }
}
