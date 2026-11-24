export class OutlineElement {
  private readonly nested: OutlineElement[] = [];
  private endOffset: number;

  constructor(
    readonly name: string,
    readonly start: number,
    readonly selectionStart: number,
    readonly selectionEnd: number,
  ) {
    this.endOffset = selectionEnd;
  }

  get end(): number { return this.endOffset; }
  get children(): readonly OutlineElement[] { return this.nested; }
  add(child: OutlineElement): void { this.nested.push(child); }
  close(end: number): void { this.endOffset = end; }
}
