import { Group } from './Group.js';
import { Shape } from './Shape.js';
import { Value } from './Value.js';

export class SvgDocument {
  private root = new Group('__canvas_root__');
  private canvasWidth: number;
  private canvasHeight: number;
  private rootAttributes: Record<string, string> = {};
  constructor(width = 800, height = 600) {
    this.canvasWidth = Value.positive(width, 'canvas width');
    this.canvasHeight = Value.positive(height, 'canvas height');
  }
  get width(): number { return this.canvasWidth; }
  get height(): number { return this.canvasHeight; }
  get children(): readonly Shape[] { return this.root.children; }
  get attributes(): Readonly<Record<string, string>> { return { ...this.rootAttributes }; }
  setRootAttributes(attributes: Readonly<Record<string, string>>): void { this.rootAttributes = { ...attributes }; }
  resize(width: number, height: number): void {
    const w = Value.positive(width, 'canvas width');
    const h = Value.positive(height, 'canvas height');
    this.canvasWidth = w; this.canvasHeight = h;
    delete this.rootAttributes.viewBox;
  }
  all(): readonly Shape[] {
    const result: Shape[] = [];
    const visit = (node: Shape): void => { result.push(node); node.children.forEach(visit); };
    this.children.forEach(visit);
    return result;
  }
  find(id: string): Shape {
    const shape = this.all().find(node => node.id === id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
  assertAvailable(id: string): void {
    Value.id(id);
    if (this.all().some(node => node.id === id) || this.rootAttributes.id === id) throw new Error(`id already exists: ${id}`);
  }
  container(id?: string): Shape {
    if (id === undefined) return this.root;
    const shape = this.all().find(node => node.id === id);
    if (!shape) throw new Error(`no such container: ${id}`);
    if (!shape.isContainer) throw new Error(`not a container: ${id}`);
    return shape;
  }
  parent(shape: Shape): Shape {
    const parent = [this.root, ...this.all()].find(node => node.children.includes(shape));
    if (!parent) throw new Error(`no parent for shape: ${shape.id}`);
    return parent;
  }
  parentLabel(shape: Shape): string { const parent = this.parent(shape); return parent === this.root ? 'svg' : parent.label; }
  insert(shape: Shape, parentId?: string): void {
    const ids = new Set(this.all().map(node => node.id));
    if (this.rootAttributes.id !== undefined) ids.add(this.rootAttributes.id);
    // Validate the whole incoming subtree before attaching any node.
    const validate = (node: Shape): void => {
      Value.id(node.id);
      if (ids.has(node.id)) throw new Error(`id already exists: ${node.id}`);
      ids.add(node.id);
      node.children.forEach(validate);
    };
    validate(shape);
    this.container(parentId).add(shape);
  }
  delete(id: string): Shape { const shape = this.find(id); this.parent(shape).remove(shape); return shape; }
  group(id: string, ids: readonly string[]): Group {
    this.assertAvailable(id);
    if (!ids.length) throw new Error('group requires at least one shape');
    if (new Set(ids).size !== ids.length) throw new Error('duplicate group member');
    const selected = ids.map(member => this.find(member));
    for (const node of selected) {
      if (selected.some(other => other !== node && Group.contains(node, other))) {
        throw new Error(`cannot group a container into its own descendant: ${node.id}`);
      }
    }
    // Document preorder defines relative order, independent of argument order.
    const ordered = this.all().filter(node => selected.includes(node));
    const firstParent = this.parent(ordered[0]!);
    const sameParent = ordered.every(node => this.parent(node) === firstParent);
    const destination = sameParent ? firstParent : this.root;
    const position = sameParent ? destination.children.indexOf(ordered[0]!) : destination.children.length;
    const group = new Group(id);
    for (const node of ordered) { this.parent(node).remove(node); group.add(node); }
    destination.add(group, sameParent ? position : destination.children.length);
    return group;
  }
  ungroup(id: string): void {
    const group = this.container(id);
    const parent = this.parent(group);
    if (parent === this.root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const index = parent.children.indexOf(group);
    parent.remove(group);
    group.children.forEach((child, offset) => { group.remove(child); parent.add(child, index + offset); });
  }
  addTo(groupId: string, id: string): void {
    const target = this.container(groupId);
    const shape = this.find(id);
    if (shape === target || Group.contains(shape, target)) throw new Error(`cannot move a container into its own descendant: ${id}`);
    this.parent(shape).remove(shape); target.add(shape);
  }
  reorder(id: string, front: boolean): void {
    const shape = this.find(id); const parent = this.parent(shape);
    parent.remove(shape); parent.add(shape, front ? parent.children.length : 0);
  }
  clone(): SvgDocument {
    const copy = new SvgDocument(this.width, this.height);
    copy.root = this.root.clone(); copy.rootAttributes = { ...this.rootAttributes };
    return copy;
  }
  restore(snapshot: SvgDocument): void {
    const copy = snapshot.clone();
    this.root = copy.root; this.rootAttributes = copy.rootAttributes;
    this.canvasWidth = copy.width; this.canvasHeight = copy.height;
  }
}
