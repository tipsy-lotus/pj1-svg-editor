import type { Shape } from '../model/Shape.js';
import type { SvgDocument } from '../model/SvgDocument.js';

export class ShapeFormatter {
  tree(document: SvgDocument, id?: string): string {
    const root = id === undefined ? undefined : document.find(id);
    const lines = [root ? this.inline(root) : `svg (${document.width}x${document.height})`];
    const visit = (children: readonly Shape[], prefix: string): void => {
      children.forEach((shape, index) => {
        const last = index === children.length - 1;
        lines.push(`${prefix}${last ? '└── ' : '├── '}${this.inline(shape)}`);
        visit(shape.children, prefix + (last ? '    ' : '│   '));
      });
    };
    visit(root ? root.children : document.children, '');
    return lines.join('\n');
  }

  show(document: SvgDocument, id: string): string {
    const shape = document.find(id);
    const lines = [`${shape.label}  parent=${document.parentLabel(shape)}`];
    const attributes = this.attributes(shape);
    if (attributes) lines.push(`  ${attributes}`);
    if (shape.supportsText) lines.push(`  text=${JSON.stringify(shape.text)}`);
    return lines.join('\n');
  }

  private inline(shape: Shape): string {
    const attributes = this.attributes(shape);
    return shape.label + (attributes ? `  ${attributes}` : '') + (shape.supportsText ? ` ${JSON.stringify(shape.text)}` : '');
  }

  private attributes(shape: Shape): string {
    return Object.entries(shape.attributes).map(([name, value]) => `${name}=${/\s|"/u.test(value) ? JSON.stringify(value) : value}`).join(' ');
  }
}
