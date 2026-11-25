import type { Command } from '../../../src/extensions/Command.js';
import type { EditorAccess } from '../../../src/extensions/EditorAccess.js';
import type { Shape } from '../../../src/model/Shape.js';

export class StatsCommand implements Command {
  readonly name = 'stats';
  readonly syntax = 'stats';
  readonly minimum = 0;
  readonly maximum = 0;
  constructor(private readonly session: Pick<EditorAccess, 'document'>) {}
  run(): string {
    const counts = new Map<string, number>();
    let containers = 0;
    let total = 0;
    const visit = (shape: Shape): void => {
      if (shape.isContainer) containers++;
      else { counts.set(shape.tag, (counts.get(shape.tag) ?? 0) + 1); total++; }
      shape.children.forEach(visit);
    };
    this.session.document.children.forEach(visit);
    const parts = [...counts].map(([type, count]) => `${type}: ${count}`);
    parts.push(`(total ${total}, containers ${containers})`);
    return parts.join('  ');
  }
}
