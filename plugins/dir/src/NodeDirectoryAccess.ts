import { readdirSync } from 'node:fs';
import type { DirectoryAccess } from './DirectoryAccess.js';
import type { DirectoryEntry } from './DirectoryEntry.js';

/** 将 Node Dirent 适配为命令所需的目录访问接口，不跟随符号链接。 */
export class NodeDirectoryAccess implements DirectoryAccess {
  currentDirectory(): string { return process.cwd(); }
  list(path: string): readonly DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map(entry => ({
      name: entry.name,
      kind: entry.isSymbolicLink() ? 'link' : entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
    }));
  }
}
