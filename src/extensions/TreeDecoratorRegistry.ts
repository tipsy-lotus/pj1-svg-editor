import type { TreeDecorator } from './TreeDecorator.js';
import type { TreeContext } from './TreeContext.js';

export class TreeDecoratorRegistry {
  private readonly decorators = new Map<string, TreeDecorator>();
  get entries(): readonly TreeDecorator[] { return [...this.decorators.values()]; }
  checkpoint(): () => void {
    const before = [...this.decorators.entries()];
    return () => { this.decorators.clear(); before.forEach(([name, value]) => this.decorators.set(name, value)); };
  }
  register(decorator: TreeDecorator): void {
    if (this.decorators.has(decorator.name)) throw new Error(`duplicate registration: decorators/${decorator.name}`);
    if (!decorator.name || typeof decorator.decorate !== 'function') throw new Error('invalid tree decorator');
    this.decorators.set(decorator.name, decorator);
  }
  suffix(context: TreeContext): string {
    const labels: string[] = [];
    for (const decorator of this.decorators.values()) {
      const label = decorator.decorate(context);
      if (label === undefined || label === '') continue;
      if (typeof label !== 'string' || /[\r\n\t]/u.test(label)) throw new Error(`invalid tree decorator result: ${decorator.name}`);
      if (label.trim()) labels.push(label.trim());
    }
    return labels.length ? ' ' + labels.join(' ') : '';
  }
}
