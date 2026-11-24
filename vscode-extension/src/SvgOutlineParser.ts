import * as sax from 'sax';
import { OutlineElement } from './OutlineElement';

export class SvgOutlineParser {
  parse(source: string): readonly OutlineElement[] {
    const roots: OutlineElement[] = [];
    const stack: OutlineElement[] = [];
    const parser = sax.parser(true, { position: true, strictEntities: true });
    let rootTag: string | undefined;
    parser.onerror = error => { throw error; };
    parser.onopentag = tag => {
      const start = parser.startTagPosition - 1;
      const id = tag.attributes.id;
      const element = new OutlineElement(
        tag.name + (id ? `#${id}` : ''), start, start + 1, start + 1 + tag.name.length,
      );
      const parent = stack.at(-1);
      if (parent) parent.add(element);
      else { roots.push(element); rootTag = tag.name; }
      stack.push(element);
    };
    parser.onclosetag = () => {
      stack.pop()!.close(parser.position);
    };
    try {
      parser.write(source).close();
      // 无 SVG 根、多个根或未闭合输入都不产生残缺的大纲。
      if (roots.length !== 1 || rootTag?.split(':').at(-1) !== 'svg' || stack.length) return [];
      return roots;
    } catch {
      return [];
    }
  }
}
