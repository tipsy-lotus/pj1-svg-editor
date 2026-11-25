import type { DirectoryEntry } from './DirectoryEntry.js';

export interface DirectoryAccess {
  currentDirectory(): string;
  list(path: string): readonly DirectoryEntry[];
}
