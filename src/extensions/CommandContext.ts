import type { Command } from './Command.js';
import type { EditorAccess } from './EditorAccess.js';
import type { ShapeFactory } from '../model/ShapeFactory.js';
import type { SvgDocument } from '../model/SvgDocument.js';
import type { AttributeRegistry } from './AttributeRegistry.js';

export interface CommandContext {
  readonly session: EditorAccess;
  readonly shapes: Pick<ShapeFactory, 'create' | 'fromAttributes' | 'fromSvg' | 'help'>;
  readonly attributes: Pick<AttributeRegistry, 'apply'>;
  registerCommand(command: Command): void;
  commands(): readonly Command[];
  tree(document: SvgDocument, id?: string): string;
  show(document: SvgDocument, id: string): string;
  close(): void;
}
