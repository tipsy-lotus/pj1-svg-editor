import type { SvgDocument } from '../model/SvgDocument.js';
import type { Shape } from '../model/Shape.js';

export interface TreeContext {
  readonly document: SvgDocument;
  /** undefined 表示 SVG 根行；tree <id> 的首行仍传入对应图形。 */
  readonly shape: Shape | undefined;
}
