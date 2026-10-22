import { Token } from './Token.js';

export class Tokenizer {
  parse(line: string): readonly Token[] {
    const source = line.replace(/^\uFEFF/, '').trim();
    if (!source || source.startsWith('#')) return [];
    const tokens: Token[] = [];
    let index = 0;
    while (index < source.length) {
      while (/\s/u.test(source[index] ?? '') && index < source.length) index++;
      if (index === source.length) break;
      const quoted = source[index] === '"';
      let value = '';
      if (quoted) {
        index++;
        let closed = false;
        while (index < source.length) {
          const character = source[index++]!;
          if (character === '\\' && source[index] === '"') { value += '"'; index++; }
          else if (character === '"') { closed = true; break; }
          else value += character;
        }
        if (!closed) throw new Error('unterminated double quote');
        if (index < source.length && !/\s/u.test(source[index]!)) throw new Error('quotes must enclose a whole argument');
      } else {
        while (index < source.length && !/\s/u.test(source[index]!)) {
          if (source[index] === '"') throw new Error('quotes must enclose a whole argument');
          value += source[index++];
        }
      }
      tokens.push(new Token(value, quoted));
    }
    return tokens;
  }
}
