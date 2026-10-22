import type { SvgDocument } from '../model/SvgDocument.js';
export interface Command {
  readonly description: string;
  execute(document: SvgDocument): string;
  undo(document: SvgDocument): void;
  redo(document: SvgDocument): void;
}
