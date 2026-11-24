import { SvgFileRepository } from '../../src/io/SvgFileRepository.js';
import { SvgCodec } from '../../src/io/SvgCodec.js';
import { DefaultShapes } from '../../src/host/DefaultShapes.js';
import type { FileStore } from '../../src/io/FileStore.js';

/** 测试组合根：为原有行为断言显式装配默认能力。 */
export class DefaultRepository extends SvgFileRepository {
  constructor(files: FileStore) { super(files, new SvgCodec(new DefaultShapes())); }
}
