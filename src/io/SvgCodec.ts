import { xml2js, type Element } from 'xml-js';
import type { Shape } from '../model/Shape.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { SvgDocument } from '../model/SvgDocument.js';
import { Value } from '../model/Value.js';
import { XmlSyntax } from './XmlSyntax.js';

export class SvgCodec {
  private readonly namespace = 'http://www.w3.org/2000/svg';
  private readonly factory = new ShapeFactory();
  private readonly numericAttributes = new Set([
    'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'stroke-width',
  ]);

  decode(source: string): { document: SvgDocument; warnings: readonly string[] } {
    Value.text(source);
    new XmlSyntax().check(source);
    let parsed: Element;
    try {
      parsed = xml2js(source, { compact: false, captureSpacesBetweenElements: true }) as Element;
    } catch {
      throw new Error('invalid SVG: malformed XML');
    }
    const top = parsed.elements ?? [];
    const roots = top.filter(node => node.type === 'element');
    if (roots.length !== 1) throw new Error('invalid SVG: expected one <svg> root');
    for (const node of top) this.checkNonElement(node);
    const root = roots[0]!;
    const rootAttributes = this.attributes(root);
    const namespaces = this.namespaces({}, rootAttributes);
    if (this.localName(root, namespaces) !== 'svg') throw new Error('invalid SVG: root must be <svg>');

    const viewBox = this.viewBox(rootAttributes.viewBox);
    const width = this.length(rootAttributes.width ?? String(viewBox?.[2] ?? 800));
    const height = this.length(rootAttributes.height ?? String(viewBox?.[3] ?? 600));
    const document = new SvgDocument(width, height);
    document.setRootAttributes(rootAttributes);

    // 先保留所有显式 ID，防止自动 ID 与文件后面出现的命名元素冲突。
    const ids = new Set<string>();
    const reserve = (node: Element): void => {
      if (node.type !== 'element') return;
      const id = this.attributes(node).id;
      if (id !== undefined) {
        Value.id(id);
        if (ids.has(id)) throw new Error(`id already exists: ${id}`);
        ids.add(id);
      }
      node.elements?.forEach(reserve);
    };
    reserve(root);
    const warnings: string[] = [];
    const counters = new Map<string, number>();
    const build = (node: Element, inherited: Readonly<Record<string, string>>): Shape => {
      const attributes = this.attributes(node);
      const context = this.namespaces(inherited, attributes);
      const tag = this.localName(node, context);
      let id = attributes.id;
      if (id === undefined) {
        let counter = counters.get(tag) ?? 0;
        do { id = `${tag}${++counter}`; } while (ids.has(id));
        counters.set(tag, counter); ids.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${tag}>`);
      }
      const normalized = Object.fromEntries(Object.entries(attributes).map(([name, value]) => [
        name, this.numericAttributes.has(name) ? String(this.length(value)) : value,
      ]));
      const shape = this.factory.fromAttributes(tag, id, normalized);
      let text = '';
      for (const child of node.elements ?? []) {
        if (child.type === 'element') shape.add(build(child, context));
        else if (child.type === 'text' || child.type === 'cdata') {
          const value = String(child.text ?? child.cdata ?? '');
          if (shape.isContainer) {
            if (value.trim()) throw new Error(`invalid SVG: unexpected text in <${tag}>`);
          } else text += value;
        } else this.checkNonElement(child);
      }
      if (shape.supportsText) shape.set('text', text);
      else if (text.trim()) throw new Error(`invalid SVG: unexpected text in <${tag}>`);
      return shape;
    };
    for (const node of root.elements ?? []) {
      if (node.type === 'element') document.insert(build(node, namespaces));
      else this.checkNonElement(node);
    }
    return { document, warnings };
  }

  encode(document: SvgDocument): string {
    const ids = new Set<string>();
    const rootId = document.attributes.id;
    if (rootId !== undefined) ids.add(Value.id(rootId));
    for (const shape of document.all()) {
      Value.id(shape.id);
      if (ids.has(shape.id)) throw new Error(`id already exists: ${shape.id}`);
      ids.add(shape.id);
    }
    const attributes = {
      ...document.attributes,
      xmlns: this.namespace,
      width: String(document.width), height: String(document.height),
      viewBox: document.attributes.viewBox ?? `0 0 ${document.width} ${document.height}`,
    };
    this.viewBox(attributes.viewBox);
    const children = document.children.map(shape => this.writeShape(shape, 1)).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg${this.writeAttributes(attributes)}>${children ? `\n${children}\n` : ''}</svg>\n`;
  }

  private writeShape(shape: Shape, depth: number): string {
    const indentation = '  '.repeat(depth);
    const attributes = this.writeAttributes({ ...shape.attributes, id: shape.id });
    if (shape.children.length) {
      const children = shape.children.map(child => this.writeShape(child, depth + 1)).join('\n');
      return `${indentation}<${shape.tag}${attributes}>\n${children}\n${indentation}</${shape.tag}>`;
    }
    return shape.text
      ? `${indentation}<${shape.tag}${attributes}>${this.escape(shape.text, false)}</${shape.tag}>`
      : `${indentation}<${shape.tag}${attributes}/>`;
  }

  private writeAttributes(attributes: Readonly<Record<string, string>>): string {
    return Object.entries(attributes).map(([name, value]) => {
      if (!/^[\p{L}_][\p{L}\p{N}_.:-]*$/u.test(name)) throw new Error(`invalid XML attribute name: ${name}`);
      return ` ${name}="${this.escape(value, true)}"`;
    }).join('');
  }

  private escape(value: string, attribute: boolean): string {
    let escaped = Value.text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;');
    if (attribute) escaped = escaped.replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
    return escaped;
  }

  private attributes(node: Element): Record<string, string> {
    return Object.fromEntries(Object.entries(node.attributes ?? {}).map(([name, value]) => [name, Value.text(String(value))]));
  }

  private namespaces(parent: Readonly<Record<string, string>>, attributes: Readonly<Record<string, string>>): Record<string, string> {
    const result = { ...parent };
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'xmlns') result[''] = value;
      else if (name.startsWith('xmlns:')) result[name.slice(6)] = value;
    }
    return result;
  }

  private localName(node: Element, namespaces: Readonly<Record<string, string>>): string {
    const parts = (node.name ?? '').split(':');
    const prefix = parts.length === 1 ? '' : parts[0]!;
    const uri = namespaces[prefix];
    if (parts.length > 2 || (prefix && !uri) || (uri !== undefined && uri !== '' && uri !== this.namespace)) {
      throw new Error(`invalid SVG: unsupported namespace for <${node.name}>`);
    }
    return parts.at(-1)!;
  }

  private checkNonElement(node: Element): void {
    if (node.type === 'element' || node.type === 'comment') return;
    if ((node.type === 'text' || node.type === 'cdata') && !String(node.text ?? node.cdata ?? '').trim()) return;
    throw new Error(`invalid SVG: unsupported ${node.type ?? 'XML node'}`);
  }

  private length(value: string): number {
    return Value.number(value.trim().replace(/px$/i, ''));
  }

  private viewBox(value?: string): readonly number[] | undefined {
    if (value === undefined) return undefined;
    const numbers = value.trim().split(/[\s,]+/).map(number => Value.number(number));
    if (numbers.length !== 4) throw new Error('invalid SVG: viewBox requires four numbers');
    Value.positive(numbers[2]!, 'viewBox width'); Value.positive(numbers[3]!, 'viewBox height');
    return numbers;
  }
}
