import type { AttributeHandler } from './AttributeHandler.js';
import type { SvgDocument } from '../model/SvgDocument.js';

export class AttributeRegistry {
  private readonly handlers = new Map<string, AttributeHandler>();
  get entries(): readonly AttributeHandler[] { return [...this.handlers.values()]; }
  checkpoint(): () => void {
    const before = [...this.handlers.entries()];
    return () => { this.handlers.clear(); before.forEach(([name, value]) => this.handlers.set(name, value)); };
  }
  register(handler: AttributeHandler): void {
    if (this.handlers.has(handler.name)) throw new Error(`duplicate registration: attributes/${handler.name}`);
    if (!handler.name || typeof handler.handles !== 'function' || typeof handler.apply !== 'function') {
      throw new Error('invalid attribute handler');
    }
    this.handlers.set(handler.name, handler);
  }
  /** 调用方必须在编辑事务内使用；异常直接向上抛，不再尝试默认处理。 */
  apply(document: SvgDocument, id: string, attribute: string, value: string): string {
    const shape = document.find(id);
    const matches = [...this.handlers.values()].filter(handler => handler.handles(shape, attribute));
    if (matches.length > 1) throw new Error(`conflicting attribute handlers: ${attribute} (${matches.map(handler => handler.name).join(', ')})`);
    const handler = matches[0];
    if (!handler) shape.set(attribute, value);
    else {
      const message = handler.apply({ document, shape }, attribute, value);
      if (message !== undefined && typeof message !== 'string') throw new Error(`invalid attribute handler result: ${handler.name}`);
      if (message !== undefined) return message;
    }
    return `${shape.label} updated: ${attribute}=${JSON.stringify(value)}`;
  }
}
