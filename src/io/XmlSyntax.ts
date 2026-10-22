export class XmlSyntax {
  check(source: string): void {
    // 依赖会折叠重复属性，并可能忽略输入结尾的未闭合错误；先补充结构检查。
    const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:"[^"]*"|'[^']*'|[^'">])*>/g;
    const stack: string[] = [];
    let offset = 0;
    for (const match of source.matchAll(tokens)) {
      if (source.slice(offset, match.index).includes('<')) throw new Error('invalid SVG: malformed XML');
      offset = match.index + match[0].length;
      const token = match[0];
      if (/^<!DOCTYPE\b/i.test(token)) throw new Error('invalid SVG: DOCTYPE is not supported');
      if (/^<[!?]/.test(token)) continue;
      if (token.startsWith('</')) {
        const closing = /^<\/([^\s>]+)\s*>$/.exec(token);
        if (!closing || stack.pop() !== closing[1]) throw new Error('invalid SVG: mismatched XML tags');
        continue;
      }
      const name = /^<([^\s/>]+)/.exec(token)?.[1];
      if (!name) throw new Error('invalid SVG: malformed XML');
      if (!token.endsWith('/>')) stack.push(name);
      const names = new Set<string>();
      const attributes = token.replace(/^<[^\s/>]+/, '');
      for (const attribute of attributes.matchAll(/([^\s=<>]+)\s*=\s*(?:"[^"]*"|'[^']*')/g)) {
        const name = attribute[1]!;
        if (names.has(name)) throw new Error(`invalid SVG: duplicate attribute: ${name}`);
        names.add(name);
      }
    }
    if (stack.length || source.slice(offset).includes('<')) throw new Error('invalid SVG: unclosed XML markup');
  }
}
