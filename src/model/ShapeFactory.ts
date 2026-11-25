import type { ShapeProvider } from '../extensions/ShapeProvider.js';
import type { SvgShapeSource } from '../extensions/SvgShapeSource.js';
import { Shape } from './Shape.js';

export class ShapeFactory {
  private readonly providers = new Map<string, ShapeProvider>();
  get entries(): readonly ShapeProvider[] { return [...this.providers.values()]; }
  checkpoint(): () => void {
    const before = [...this.providers.entries()];
    return () => { this.providers.clear(); before.forEach(([name, value]) => this.providers.set(name, value)); };
  }

  register(provider: ShapeProvider): void {
    if (this.providers.has(provider.name)) throw new Error(`duplicate registration: shapes/${provider.name}`);
    if (!provider.name || !provider.help || !Number.isFinite(provider.svgPriority)
      || typeof provider.create !== 'function' || typeof provider.read !== 'function'
      || typeof provider.matchesSvg !== 'function') throw new Error('invalid shape provider');
    this.providers.set(provider.name, provider);
  }

  get help(): readonly string[] { return [...this.providers.values()].map(provider => provider.help); }

  create(type: string, id: string, params: readonly string[]): Shape {
    return this.validate(this.definition(type).create(id, params), id);
  }

  fromAttributes(type: string, id: string, attributes: Readonly<Record<string, string>>): Shape {
    return this.validate(this.definition(type).read({ tag: type, id, attributes, children: [], text: '' }), id);
  }

  fromSvg(source: SvgShapeSource): Shape {
    const candidates = [...this.providers.values()]
      .filter(provider => provider.matchesSvg(source.tag, source.attributes))
      .sort((left, right) => right.svgPriority - left.svgPriority);
    const provider = candidates[0];
    if (!provider) throw new Error(`unknown shape type: ${source.tag} (is the plugin loaded?)`);
    if (candidates[1]?.svgPriority === provider.svgPriority) throw new Error(`ambiguous shape providers for <${source.tag}>`);
    return this.validate(provider.read(source), source.id);
  }

  private validate(shape: Shape, id: string): Shape {
    if (!(shape instanceof Shape) || shape.id !== id) throw new Error(`shape provider returned invalid shape: ${id}`);
    return shape;
  }

  private definition(type: string): ShapeProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return provider;
  }
}
