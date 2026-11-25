import { Group } from '../../src/model/Group.js';
import type { Shape } from '../../src/model/Shape.js';

/** 用领域多态验证保护钩子，不使用 box 名称分派。 */
export class ProtectedGroup extends Group {
  override get label(): string { return `protected#${this.id}`; }
  override get treeLabel(): string { return `g#${this.id}`; }
  override assertCanRemove(child: Shape): void {
    if (child.id === `${this.id}-part`) throw new Error('required child cannot be removed');
  }
  override assertCanUngroup(): void { throw new Error('protected container cannot be ungrouped'); }
  override clone(): ProtectedGroup {
    const copy = this.copyTo(new ProtectedGroup(this.id));
    this.children.forEach(child => copy.add(child.clone()));
    return copy;
  }
}
