import { randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { FileStore } from './FileStore.js';

export class NodeFileStore implements FileStore {
  read(path: string): string {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    } catch {
      throw new Error(`cannot read file: ${path}`);
    }
  }

  write(path: string, content: string): void {
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    let created = false;
    try {
      const descriptor = openSync(temporary, 'wx');
      created = true;
      try { writeFileSync(descriptor, content, 'utf8'); }
      finally { closeSync(descriptor); }
      renameSync(temporary, path);
    } catch {
      throw new Error(`cannot write file: ${path}`);
    } finally {
      if (created) {
        try { rmSync(temporary, { force: true }); }
        catch { /* 清理失败不覆盖原始读写结果。 */ }
      }
    }
  }
}
