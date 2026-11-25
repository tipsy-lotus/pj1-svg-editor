import type { SvgDocument } from '../model/SvgDocument.js';
import type { Shape } from '../model/Shape.js';

export interface TreeContext {
  readonly document: SvgDocument;
  /** undefined 表示 SVG 根行；tree <id> 的首行仍传入对应图形。 */
  readonly shape: Shape | undefined;
  /** 上次成功 read/save 的隔离快照；新建未保存时缺省。 */
  readonly savedDocument?: SvgDocument;
}
