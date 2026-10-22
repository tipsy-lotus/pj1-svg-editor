import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { NodeFileStore } from '../src/io/NodeFileStore.js';
import { SvgCodec } from '../src/io/SvgCodec.js';
import { SvgFileRepository } from '../src/io/SvgFileRepository.js';
import { Group } from '../src/model/Group.js';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgDocument } from '../src/model/SvgDocument.js';

const codec = new SvgCodec();
const factory = new ShapeFactory();
const namespace = 'http://www.w3.org/2000/svg';

test('导出六种图形为带命名空间的 SVG，保存读回保留尺寸和结构', () => {
  const document = new SvgDocument(400, 300);
  document.insert(new Group('scene'));
  for (const [type, id, params] of [
    ['rect', 'r', ['1', '2', '30', '40', '#abc']],
    ['circle', 'c', ['50', '60', '7', 'red']],
    ['ellipse', 'e', ['70', '80', '9', '10']],
    ['line', 'l', ['1', '2', '3', '4', 'black']],
    ['text', 't', ['10', '20', '流程图 😀']],
  ] as const) document.insert(factory.create(type, id, params), 'scene');
  const xml = codec.encode(document);
  assert.match(xml, /<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  const result = codec.decode(xml);
  assert.equal(result.document.width, 400); assert.equal(result.document.height, 300);
  assert.deepEqual(result.document.children, document.children);
  assert.deepEqual(result.warnings, []);
  assert.equal(codec.encode(result.document), xml);
});

test('自动 ID 避开后续显式 ID，按类型递增并保持文档顺序', () => {
  const { document, warnings } = codec.decode('<svg><g><rect/><rect id="rect1"/><circle/><rect/></g><g id="g1"/></svg>');
  assert.deepEqual(document.all().map(shape => shape.id), ['g2', 'rect2', 'rect1', 'circle1', 'rect3', 'g1']);
  assert.deepEqual(warnings, [
    'warning: assigned id g2 to unnamed <g>',
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id circle1 to unnamed <circle>',
    'warning: assigned id rect3 to unnamed <rect>',
  ]);
});

test('显式 ID 包括根节点 ID，重复或空 ID 被拒绝，大小写敏感', () => {
  for (const xml of [
    '<svg><rect id="r"/><g><circle id="r"/></g></svg>',
    '<svg id="root"><rect id="root"/></svg>',
  ]) assert.throws(() => codec.decode(xml), /id already exists/);
  assert.throws(() => codec.decode('<svg><rect id=""/></svg>'), /id must be nonempty/);
  const { document } = codec.decode('<svg id="rect1"><rect/><rect id="R"/><rect id="r"/></svg>');
  assert.deepEqual(document.all().map(shape => shape.id), ['rect2', 'R', 'r']);
});

test('文字转义、中文、引号、换行及前后空白可往返', () => {
  const document = new SvgDocument();
  const content = '  开始 & <处理> "双引号" \'单引号\'\n第二行\r\n😀  ';
  document.insert(factory.create('text', 't', ['1', '2', content]));
  document.find('t').set('fill', 'a"&<>\n\t');
  const xml = codec.encode(document);
  assert.match(xml, /&amp;/); assert.match(xml, /&lt;/); assert.match(xml, /&quot;/);
  assert.match(xml, /&#10;/); assert.match(xml, /&#9;/); assert.match(xml, /&#13;/);
  const imported = codec.decode(xml).document.find('t');
  assert.equal(imported.text, content);
  assert.equal(imported.attributes.fill, 'a"&<>\n\t');
});

test('CDATA 和 XML 实体组成完整文字，注释不作为图形或文字', () => {
  const { document, warnings } = codec.decode('<svg><!--备注--><text id="t"> A <![CDATA[<B>&C]]><!--内部备注--> D &amp; E </text></svg>');
  assert.equal(document.find('t').text, ' A <B>&C D & E ');
  assert.equal(document.all().length, 1);
  assert.deepEqual(warnings, []);
});

test('保留空文字、空分组和未指定的样式，不引入默认颜色', () => {
  const { document } = codec.decode('<svg><g id="g"/><text id="t"/><rect id="r"/></svg>');
  assert.equal(document.find('t').text, '');
  assert.equal(document.find('g').children.length, 0);
  const result = codec.decode(codec.encode(document)).document;
  assert.deepEqual(result.children, document.children);
  assert.equal(result.find('r').attributes.fill, undefined);
});

test('支持数值及 px 单位，缺少画布尺寸时使用 viewBox 或默认值', () => {
  const px = codec.decode('<svg width="400px" height="300px"><rect id="r" x="-1.5px" width="12px"/></svg>').document;
  assert.equal(px.width, 400); assert.equal(px.height, 300);
  assert.equal(px.find('r').attributes.x, '-1.5');
  assert.equal(px.find('r').attributes.width, '12');
  const derived = codec.decode('<svg viewBox="-10 -20 500 200"/>').document;
  assert.equal(derived.width, 500); assert.equal(derived.height, 200);
  assert.match(codec.encode(derived), /viewBox="-10 -20 500 200"/);
  const fallback = codec.decode('<svg/>').document;
  assert.equal(fallback.width, 800); assert.equal(fallback.height, 600);
});

test('拒绝非法尺寸、负半径、百分比长度和错误 viewBox', () => {
  for (const xml of [
    '<svg width="0"/>', '<svg height="-2"/>', '<svg width="50%"/>',
    '<svg viewBox="0 0 10"/>', '<svg viewBox="0 0 -1 10"/>',
    '<svg><circle id="c" r="-1"/></svg>', '<svg><rect id="r" x="NaN"/></svg>',
  ]) assert.throws(() => codec.decode(xml));
});

test('支持 SVG 命名空间前缀，拒绝外部命名空间和未绑定前缀', () => {
  const { document } = codec.decode(`<s:svg xmlns:s="${namespace}"><s:g id="g"><s:rect id="r"/></s:g></s:svg>`);
  assert.equal(document.find('r').tag, 'rect');
  assert.deepEqual(codec.decode(codec.encode(document)).document.children, document.children);
  for (const xml of [
    '<svg xmlns="urn:other"/>', '<s:svg/>',
    `<svg xmlns="${namespace}"><rect xmlns="urn:other" id="r"/></svg>`,
  ]) assert.throws(() => codec.decode(xml), /namespace/);
});

test('保留分组样式、字体、viewBox 和额外属性，导入 set 白名单仍生效', () => {
  const source = `<svg xmlns="${namespace}" width="400" height="300" viewBox="0 0 200 150" data-name="demo"><g id="g" fill="red" transform="translate(10,20)"><text id="t" font-size="16" text-anchor="middle">标题</text></g></svg>`;
  const { document } = codec.decode(source);
  assert.equal(document.attributes['data-name'], 'demo');
  assert.equal(document.find('g').attributes.transform, 'translate(10,20)');
  assert.equal(document.find('t').attributes['font-size'], '16');
  assert.throws(() => document.find('t').set('font-size', '20'), /unknown attribute/);
  assert.equal(codec.encode(codec.decode(codec.encode(document)).document), codec.encode(document));
});

test('未知元素和叶子中的嵌套元素被拒绝，不静默丢失内容', () => {
  assert.throws(() => codec.decode('<svg><path id="p" d="M0 0"/></svg>'), /unknown shape type: path/);
  assert.throws(() => codec.decode('<svg><text id="t"><tspan id="s">a</tspan></text></svg>'), /unknown shape type: tspan/);
  assert.throws(() => codec.decode('<svg><rect id="r"><circle id="c"/></rect></svg>'), /not a container: r/);
  assert.throws(() => codec.decode('<svg><rect id="r">unexpected</rect></svg>'), /unexpected text/);
  assert.throws(() => codec.decode('<svg><g id="g">unexpected</g></svg>'), /unexpected text/);
});

test('拒绝非法 XML、多个根节点、重复属性、未知实体和不支持的声明', () => {
  for (const source of [
    '', '<rect/>', '<svg>', '<svg><g></svg>', '<svg/><svg/>',
    '<svg><text>&unknown;</text></svg>', '<svg width="1" width="2"/>',
    '<?xml-stylesheet href="a.css"?><svg/>', '<!DOCTYPE svg><svg/>',
    '<svg>unexpected</svg>', '<svg>\u0000</svg>',
  ]) assert.throws(() => codec.decode(source), Error, source);
});

test('重复属性检查不将注释、CDATA 或属性值中的标记误判为属性', () => {
  const source = '<svg><!-- <g a="1" a="2"/> --><text id="t"><![CDATA[<g a="1" a="2"/>]]></text><g id="g" data-note="a=\'1\' a=\'2\'"/></svg>';
  const { document } = codec.decode(source);
  assert.equal(document.find('t').text, '<g a="1" a="2"/>');
  assert.equal(document.find('g').attributes['data-note'], "a='1' a='2'");
});

test('读取失败不会修改已有文档，警告随成功解析结果一起返回', () => {
  const existing = new SvgDocument(); existing.insert(new Group('existing'));
  const snapshot = existing.clone();
  assert.throws(() => codec.decode('<svg><rect/><circle id="x" r="-1"/></svg>'), /nonnegative/);
  assert.deepEqual(existing, snapshot);
  assert.deepEqual(codec.decode('<svg><rect/></svg>').warnings, ['warning: assigned id rect1 to unnamed <rect>']);
});

test('导出前检查被底层操作绕过的重复 ID 和非法属性名', () => {
  const document = new SvgDocument(); document.insert(new Group('g'));
  document.find('g').add(new Group('same')); document.find('g').add(new Group('same'));
  assert.throws(() => codec.encode(document), /id already exists: same/);
  const invalid = new SvgDocument(); invalid.insert(new Group('g'));
  invalid.find('g').importAttributes({ 'bad name': 'value' });
  assert.throws(() => codec.encode(invalid), /invalid XML attribute name/);
});

test('真实文件读写支持中文与空格路径，覆盖保存无临时文件残留', () => {
  const base = resolve('.cache'); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'svg-io-'));
  try {
    const path = join(directory, '流程 图.svg');
    const repository = new SvgFileRepository(new NodeFileStore());
    const document = new SvgDocument(400, 300);
    document.insert(factory.create('text', 't', ['1', '2', '第一次']));
    repository.save(document, path);
    assert.equal(repository.read(path).document.find('t').text, '第一次');
    document.find('t').set('text', '第二次 & <更新>');
    repository.save(document, path);
    assert.equal(repository.read(path).document.find('t').text, '第二次 & <更新>');
    assert.deepEqual(readdirSync(directory), ['流程 图.svg']);
  } finally {
    assert.equal(dirname(directory), base); assert.ok(basename(directory).startsWith('svg-io-'));
    rmSync(directory, { recursive: true });
  }
});

test('文件读取失败给出约定错误，拒绝无效 UTF-8', () => {
  const base = resolve('.cache'); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'svg-io-'));
  try {
    const files = new NodeFileStore();
    const missing = join(directory, 'missing.svg');
    assert.throws(() => files.read(missing), { message: `cannot read file: ${missing}` });
    const invalid = join(directory, 'invalid.svg'); writeFileSync(invalid, Buffer.from([0xff, 0xfe]));
    assert.throws(() => files.read(invalid), { message: `cannot read file: ${invalid}` });
  } finally {
    assert.equal(dirname(directory), base); assert.ok(basename(directory).startsWith('svg-io-'));
    rmSync(directory, { recursive: true });
  }
});

test('不可写目标报告约定错误，替换失败清理临时文件并保留原目标', () => {
  const base = resolve('.cache'); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'svg-io-'));
  try {
    const files = new NodeFileStore(); const blocked = join(directory, 'blocked.svg');
    mkdirSync(blocked); writeFileSync(join(blocked, 'keep.txt'), '保留');
    assert.throws(() => files.write(blocked, '<svg/>'), { message: `cannot write file: ${blocked}` });
    assert.equal(readFileSync(join(blocked, 'keep.txt'), 'utf8'), '保留');
    assert.deepEqual(readdirSync(directory), ['blocked.svg']);
    const missingParent = join(directory, 'missing', 'file.svg');
    assert.throws(() => files.write(missingParent, '<svg/>'), { message: `cannot write file: ${missingParent}` });
  } finally {
    assert.equal(dirname(directory), base); assert.ok(basename(directory).startsWith('svg-io-'));
    rmSync(directory, { recursive: true });
  }
});

test('保存前校验失败不会覆盖已有文件', () => {
  const base = resolve('.cache'); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, 'svg-io-'));
  try {
    const path = join(directory, 'keep.svg'); writeFileSync(path, '原文件', 'utf8');
    const document = new SvgDocument(); document.insert(new Group('g'));
    document.find('g').importAttributes({ 'bad name': 'value' });
    const repository = new SvgFileRepository(new NodeFileStore());
    assert.throws(() => repository.save(document, path), /invalid XML attribute name/);
    assert.equal(readFileSync(path, 'utf8'), '原文件');
    assert.deepEqual(readdirSync(directory), ['keep.svg']);
  } finally {
    assert.equal(dirname(directory), base); assert.ok(basename(directory).startsWith('svg-io-'));
    rmSync(directory, { recursive: true });
  }
});

test('项目示例可导入并再次导出，缺 ID 示例按约定产生警告', () => {
  const repository = new SvgFileRepository(new NodeFileStore());
  const flow = repository.read('examples/two-nodes.svg');
  assert.equal(flow.document.all().length, 8);
  assert.equal(flow.document.parentLabel(flow.document.find('process-label')), 'g#node2');
  assert.equal(flow.document.find('start-label').text, '开始');
  assert.deepEqual(flow.warnings, []);
  const xml = codec.encode(flow.document);
  assert.equal(codec.encode(codec.decode(xml).document), xml);
  const imported = repository.read('examples/import-example.svg');
  assert.equal(imported.document.all().length, 7);
  assert.deepEqual(imported.warnings, ['warning: assigned id rect1 to unnamed <rect>']);
  assert.equal(imported.document.find('title').text, '导入示例 & ID 自动分配');
});
