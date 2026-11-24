import type { ShapeProvider } from '../../src/extensions/ShapeProvider.js';
import type { SvgShapeSource } from '../../src/extensions/SvgShapeSource.js';
import { Group } from '../../src/model/Group.js';

/** 只依赖内核公开接口的测试插件，不依赖默认装配或内置插件。 */
export class SampleShapeProvider implements ShapeProvider {
  readonly help = '  panel <id>';
  constructor(readonly name = 'panel', readonly svgPriority = 10) {}
  create(id: string, parameters: readonly string[]): Group {
    if (parameters.length) throw new Error('usage: create panel <id>');
    const group = new Group(id);
    group.importAttributes({ 'data-kind': 'panel' });
    return group;
  }
  matchesSvg(tag: string, attributes: Readonly<Record<string, string>>): boolean {
    return tag === 'g' && attributes['data-kind'] === 'panel';
  }
  read(source: SvgShapeSource): Group {
    if (!source.children.length) throw new Error('panel requires at least one child');
    const group = new Group(source.id);
    group.importAttributes({ ...source.attributes, 'data-restored': this.name });
    source.children.forEach(child => group.add(child));
    return group;
  }
}
