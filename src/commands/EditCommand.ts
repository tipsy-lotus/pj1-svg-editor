import type { Command } from './Command.js';
import { SvgDocument } from '../model/SvgDocument.js';

export abstract class EditCommand implements Command {
  private before?: SvgDocument;
  private after?: SvgDocument;
  abstract readonly description: string;
  execute(document: SvgDocument): string {
    // 重做使用已保存的快照；重复执行会覆盖该命令的原始历史。
    if (this.before) throw new Error('command has already executed');
    const snapshot = document.clone();
    try {
      const message = this.apply(document);
      this.before = snapshot; this.after = document.clone();
      return message;
    } catch (error) { document.restore(snapshot); throw error; }
  }
  undo(document: SvgDocument): void {
    if (!this.before) throw new Error('command has not executed');
    document.restore(this.before);
  }
  redo(document: SvgDocument): void {
    if (!this.after) throw new Error('command has not executed');
    document.restore(this.after);
  }
  protected abstract apply(document: SvgDocument): string;
}
