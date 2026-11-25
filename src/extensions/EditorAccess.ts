import type { SvgDocument } from '../model/SvgDocument.js';
import type { Command as UndoableCommand } from '../commands/Command.js';

/** 命令插件使用的公开会话能力，不暴露历史栈或仓库实现。 */
export interface EditorAccess {
  readonly document: SvgDocument;
  readonly currentPath: string | undefined;
  readonly savedDocument: SvgDocument | undefined;
  init(width?: number, height?: number): string;
  read(path: string): readonly string[];
  save(path?: string): string;
  canvas(width?: number, height?: number): string;
  execute(command: UndoableCommand): string;
  undo(): string;
  redo(): string;
}
