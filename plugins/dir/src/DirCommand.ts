import type { Command } from '../../../src/extensions/Command.js';
import type { DirectoryAccess } from './DirectoryAccess.js';

export class DirCommand implements Command {
  readonly name = 'dir';
  readonly syntax = 'dir';
  readonly minimum = 0;
  readonly maximum = 0;
  constructor(private readonly directory: DirectoryAccess) {}
  run(): string {
    const path = this.directory.currentDirectory();
    try {
      const order = { directory: 0, file: 1, link: 2, other: 3 };
      const labels = { directory: 'DIR', file: 'FILE', link: 'LINK', other: 'OTHER' };
      const entries = [...this.directory.list(path)].filter(entry => entry.name !== '.' && entry.name !== '..');
      entries.sort((a, b) => order[a.kind] - order[b.kind] || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return entries.length ? entries.map(entry => `[${labels[entry.kind]}]  ${entry.name}`).join('\n') : '(empty directory)';
    } catch { throw new Error(`cannot read directory: ${path}`); }
  }
}
