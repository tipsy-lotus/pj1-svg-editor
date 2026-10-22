export class Value {
  static number(value: string | number): number {
    if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
      throw new Error(`invalid number: ${value}`);
    }
    const result = Number(value);
    if (!Number.isFinite(result)) throw new Error(`invalid number: ${value}`);
    return Object.is(result, -0) ? 0 : result;
  }

  static positive(value: string | number, label: string): number {
    const result = this.number(value);
    if (result <= 0) throw new Error(`${label} must be positive`);
    return result;
  }

  static text(value: string): string {
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value) || /[\ud800-\udfff]/u.test(value)) {
      throw new Error('invalid XML character');
    }
    return value;
  }

  static id(value: string): string {
    this.text(value);
    if (!value || /\s/u.test(value)) throw new Error('id must be nonempty and contain no whitespace');
    return value;
  }
}
