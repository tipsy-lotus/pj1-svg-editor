import type { FileStore } from '../../src/io/FileStore.js';

export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, string>();
  private readonly blockedReads = new Set<string>();
  private readonly blockedWrites = new Set<string>();

  put(path: string, content: string): void { this.files.set(path, content); }
  blockRead(path: string): void { this.blockedReads.add(path); }
  blockWrite(path: string): void { this.blockedWrites.add(path); }
  read(path: string): string {
    const content = this.files.get(path);
    if (content === undefined || this.blockedReads.has(path)) throw new Error(`cannot read file: ${path}`);
    return content;
  }
  write(path: string, content: string): void {
    if (this.blockedWrites.has(path)) throw new Error(`cannot write file: ${path}`);
    this.files.set(path, content);
  }
}
