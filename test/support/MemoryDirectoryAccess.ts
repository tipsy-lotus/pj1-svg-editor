import type { DirectoryAccess } from '../../plugins/dir/src/DirectoryAccess.js';
import type { DirectoryEntry } from '../../plugins/dir/src/DirectoryEntry.js';

export class MemoryDirectoryAccess implements DirectoryAccess {
  fail = false;
  readonly requested: string[] = [];
  constructor(readonly entries: readonly DirectoryEntry[], private readonly path = '/fixed') {}
  currentDirectory(): string { return this.path; }
  list(path: string): readonly DirectoryEntry[] {
    this.requested.push(path);
    if (this.fail) throw new Error('test read failure');
    return this.entries;
  }
}
