import { Shape } from './Shape.js';
export class Group extends Shape {
  readonly tag = 'g';
  private readonly members: Shape[] = [];
  constructor(id: string) { super(id, [], [], []); }
  override get isContainer(): boolean { return true; }
  override get children(): readonly Shape[] { return [...this.members]; }
  override add(child: Shape, index = this.members.length): void {
    if (child === this || Group.contains(child, this)) throw new Error('cannot create a container cycle');
    if (this.members.includes(child)) throw new Error(`shape already in container: ${child.id}`);
    if (!Number.isInteger(index) || index < 0 || index > this.members.length) throw new Error('invalid child index');
    this.members.splice(index, 0, child);
  }
  override remove(child: Shape): void {
    const index = this.members.indexOf(child);
    if (index < 0) throw new Error(`shape not in container: ${child.id}`);
    this.members.splice(index, 1);
  }
  override move(dx: number, dy: number): void {
    super.move(dx, dy);
    for (const child of this.members) child.move(dx, dy);
  }
  override scale(factor: number): void {
    super.scale(factor);
    for (const child of this.members) child.scale(factor);
  }
  clone(): Group {
    const copy = this.copyTo(new Group(this.id));
    for (const child of this.members) copy.add(child.clone());
    return copy;
  }
  static contains(root: Shape, target: Shape): boolean {
    return root.children.some(child => child === target || this.contains(child, target));
  }
}
