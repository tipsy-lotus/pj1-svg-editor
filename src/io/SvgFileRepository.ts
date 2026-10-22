import type { SvgDocument } from '../model/SvgDocument.js';
import type { FileStore } from './FileStore.js';
import { SvgCodec } from './SvgCodec.js';

export class SvgFileRepository {
  constructor(private readonly files: FileStore, private readonly codec = new SvgCodec()) {}

  read(path: string): ReturnType<SvgCodec['decode']> {
    return this.codec.decode(this.files.read(path));
  }

  save(document: SvgDocument, path: string): void {
    this.files.write(path, this.codec.encode(document));
  }
}
