import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group } from '../src/model/Group.js';
import { Rect } from '../src/model/Rect.js';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Value } from '../src/model/Value.js';

const factory = new ShapeFactory();

test('六种图形按参数创建，未指定样式时保留 SVG 默认值', () => {
  const cases = [
    { type: 'rect', params: ['1', '2', '30', '40'], attributes: { x: '1', y: '2', width: '30', height: '40' } },
    { type: 'circle', params: ['1', '2', '3'], attributes: { cx: '1', cy: '2', r: '3' } },
    { type: 'ellipse', params: ['1', '2', '3', '4'], attributes: { cx: '1', cy: '2', rx: '3', ry: '4' } },
    { type: 'line', params: ['1', '2', '3', '4'], attributes: { x1: '1', y1: '2', x2: '3', y2: '4' } },
    { type: 'text', params: ['1', '2', '开始 & 结束 😀'], attributes: { x: '1', y: '2' } },
    { type: 'g', params: [], attributes: {} },
  ];
  for (const item of cases) {
    const shape = factory.create(item.type, item.type, item.params);
    assert.equal(shape.tag, item.type);
    assert.deepEqual(shape.attributes, item.attributes);
    assert.equal(shape.isContainer, item.type === 'g');
    if (item.type === 'text') assert.equal(shape.text, '开始 & 结束 😀');
  }
});

for (const item of [
  { type: 'rect', params: ['1', '2', '3', '4'], expected: { x: '12', y: '-2', width: '6', height: '8' } },
  { type: 'circle', params: ['1', '2', '3'], expected: { cx: '12', cy: '-2', r: '6' } },
  { type: 'ellipse', params: ['1', '2', '3', '4'], expected: { cx: '12', cy: '-2', rx: '6', ry: '8' } },
  { type: 'line', params: ['1', '2', '3', '4'], expected: { x1: '12', y1: '-2', x2: '16', y2: '2' } },
  { type: 'text', params: ['1', '2', '文字'], expected: { x: '12', y: '-2' } },
]) {
  test(`${item.type} 平移位置，缩放位置和尺寸，保留样式及文字`, () => {
    const shape = factory.create(item.type, 'target', item.params);
    shape.set('fill', 'red');
    shape.set('stroke-width', '2');
    shape.move(5, -3);
    shape.scale(2);
    assert.deepEqual(shape.attributes, { ...item.expected, fill: 'red', 'stroke-width': '2' });
    if (item.type === 'text') assert.equal(shape.text, '文字');
  });
}

test('数值支持浮点、负坐标和科学计数法，拒绝非有限或不完整输入', () => {
  const rect = factory.create('rect', 'r', ['-.5', '2e2', '0', '3.25']);
  assert.equal(rect.attributes.x, '-0.5');
  assert.equal(rect.attributes.y, '200');
  for (const value of ['', ' ', '12px', '0x10', 'NaN', 'Infinity', '1e999']) {
    assert.throws(() => rect.set('x', value), /invalid number/);
  }
  for (const value of ['-1', '-0.5']) assert.throws(() => rect.set('width', value), /nonnegative/);
  for (const factor of [0, -1]) assert.throws(() => rect.scale(factor), /scale factor must be positive/);
  assert.throws(() => rect.set('stroke-width', '-1'), /nonnegative/);
});

test('属性白名单按类型生效，文字与 ID 不能误设到其他属性', () => {
  const rect = new Rect('r');
  for (const name of ['r', 'text', 'id', 'transform', 'opacity']) {
    assert.throws(() => rect.set(name, '1'), new RegExp(`unknown attribute: ${name}`));
  }
  assert.throws(() => new Group('g').set('x', '1'), /unknown attribute: x/);
  assert.throws(() => factory.create('text', 't', ['1', '2', '\u0000']), /invalid XML character/);
  assert.throws(() => Value.text('\ud800'), /invalid XML character/);
  assert.throws(() => new Rect(''), /id must be nonempty/);
  assert.throws(() => new Rect('has space'), /whitespace/);
});

test('工厂拒绝未知类型和错误参数数量，可选颜色按图形设置', () => {
  assert.throws(() => factory.create('box', 'b', []), /unknown shape type: box/);
  assert.throws(() => factory.create('rect', 'r', ['1']), /usage: create rect/);
  assert.throws(() => factory.create('g', 'g', ['extra']), /usage: create g/);
  assert.equal(factory.create('circle', 'c', ['1', '2', '3', '#fff']).attributes.fill, '#fff');
  assert.equal(factory.create('line', 'l', ['1', '2', '3', '4', 'black']).attributes.stroke, 'black');
});

test('嵌套分组递归变换全部叶子，分组样式不覆盖子元素', () => {
  const outer = new Group('outer');
  const inner = new Group('inner');
  const rect = factory.create('rect', 'r', ['1', '2', '3', '4', 'blue']);
  const text = factory.create('text', 't', ['10', '20', '开始']);
  outer.add(inner); inner.add(rect); outer.add(text);
  outer.set('fill', 'red');
  outer.move(2, 3); outer.scale(2);
  assert.deepEqual(rect.attributes, { x: '6', y: '10', width: '6', height: '8', fill: 'blue' });
  assert.deepEqual(text.attributes, { x: '24', y: '46' });
  assert.deepEqual(outer.attributes, { fill: 'red' });
  assert.equal(inner.children[0], rect);
});

test('空分组也拒绝非法移动和缩放参数', () => {
  const empty = new Group('empty');
  assert.throws(() => empty.move(Number.NaN, 1), /invalid number/);
  assert.throws(() => empty.move(0, Infinity), /invalid number/);
  assert.throws(() => empty.scale(0), /scale factor must be positive/);
});

test('分组拒绝循环、重复成员和非法插入位置', () => {
  const a = new Group('a'); const b = new Group('b'); const rect = new Rect('r');
  a.add(b); b.add(rect);
  assert.throws(() => a.add(a), /cycle/);
  assert.throws(() => b.add(a), /cycle/);
  assert.throws(() => a.add(b), /already in container/);
  assert.throws(() => a.add(new Rect('other'), -1), /invalid child index/);
  assert.throws(() => rect.add(new Rect('child')), /not a container: r/);
  assert.deepEqual(a.children, [b]);
  assert.deepEqual(b.children, [rect]);
});

test('属性和子节点查询返回副本，外部修改集合不会改变内部状态', () => {
  const rect = new Rect('r'); const group = new Group('g'); group.add(rect);
  const attributes = rect.attributes as Record<string, string>;
  attributes.x = '999';
  const children = group.children as Rect[]; children.pop();
  assert.equal(rect.attributes.x, '0');
  assert.equal(group.children.length, 1);
});

test('文档 ID 大小写敏感，拒绝重复 ID、缺失图形和非容器父级', () => {
  const document = new SvgDocument();
  document.insert(new Rect('a')); document.insert(new Rect('A'));
  assert.equal(document.find('A').id, 'A');
  assert.throws(() => document.insert(new Rect('a')), /id already exists: a/);
  assert.throws(() => document.find('missing'), /no such shape: missing/);
  assert.throws(() => document.insert(new Rect('b'), 'missing'), /no such container: missing/);
  assert.throws(() => document.insert(new Rect('b'), 'a'), /not a container: a/);
  assert.deepEqual(document.all().map(shape => shape.id), ['a', 'A']);
});

test('插入整棵子树前检查全部 ID，拒绝内部重复和与已有后代的冲突', () => {
  const document = new SvgDocument(); document.insert(new Rect('existing'));
  const incoming = new Group('incoming'); incoming.add(new Rect('existing'));
  assert.throws(() => document.insert(incoming), /id already exists: existing/);
  const duplicates = new Group('duplicates');
  duplicates.add(new Rect('same')); duplicates.add(new Rect('same'));
  assert.throws(() => document.insert(duplicates), /id already exists: same/);
  const parentConflict = new Group('parent'); parentConflict.add(new Rect('parent'));
  assert.throws(() => document.insert(parentConflict), /id already exists: parent/);
  assert.deepEqual(document.all().map(shape => shape.id), ['existing']);
});

test('同级分组保持文档顺序，解组在原位置展开，根级容器拒绝解组', () => {
  const document = new SvgDocument(); document.insert(new Group('scene'));
  for (const id of ['before', 'a', 'b', 'after']) document.insert(new Rect(id), 'scene');
  document.group('selected', ['b', 'a']);
  assert.deepEqual(document.find('scene').children.map(shape => shape.id), ['before', 'selected', 'after']);
  assert.deepEqual(document.find('selected').children.map(shape => shape.id), ['a', 'b']);
  document.ungroup('selected');
  assert.deepEqual(document.find('scene').children.map(shape => shape.id), ['before', 'a', 'b', 'after']);
  assert.throws(() => document.ungroup('scene'), /cannot ungroup top-level container: scene/);
});

test('跨父级分组保留文档遍历顺序并放在根级末尾', () => {
  const document = new SvgDocument();
  document.insert(new Group('left')); document.insert(new Group('right'));
  document.insert(new Rect('a'), 'left'); document.insert(new Rect('b'), 'right');
  document.group('both', ['b', 'a']);
  assert.deepEqual(document.children.map(shape => shape.id), ['left', 'right', 'both']);
  assert.deepEqual(document.find('both').children.map(shape => shape.id), ['a', 'b']);
  assert.equal(document.find('left').children.length, 0);
  assert.equal(document.find('right').children.length, 0);
});

test('非法分组和移入操作保持原父子关系，正常移入放在目标末尾', () => {
  const document = new SvgDocument(); document.insert(new Group('outer'));
  document.insert(new Group('inner'), 'outer'); document.insert(new Rect('a'), 'inner');
  document.insert(new Rect('b'), 'outer');
  assert.throws(() => document.group('bad', ['a', 'outer']), /cannot group a container into its own descendant: outer/);
  assert.throws(() => document.group('bad', ['a', 'a']), /duplicate group member/);
  assert.throws(() => document.group('bad', []), /group requires at least one shape/);
  assert.throws(() => document.addTo('inner', 'outer'), /own descendant/);
  assert.throws(() => document.addTo('inner', 'inner'), /own descendant/);
  assert.equal(document.parentLabel(document.find('a')), 'g#inner');
  assert.equal(document.parentLabel(document.find('inner')), 'g#outer');
  document.addTo('inner', 'b');
  assert.deepEqual(document.find('inner').children.map(shape => shape.id), ['a', 'b']);
});

test('前置后置仅改变同级顺序，删除分组连同所有后代', () => {
  const document = new SvgDocument(); document.insert(new Group('g'));
  for (const id of ['a', 'b', 'c']) document.insert(new Rect(id), 'g');
  document.insert(new Rect('outside'));
  document.reorder('a', true);
  assert.deepEqual(document.find('g').children.map(shape => shape.id), ['b', 'c', 'a']);
  document.reorder('c', false);
  assert.deepEqual(document.find('g').children.map(shape => shape.id), ['c', 'b', 'a']);
  assert.deepEqual(document.children.map(shape => shape.id), ['g', 'outside']);
  document.delete('g');
  assert.deepEqual(document.all().map(shape => shape.id), ['outside']);
  assert.throws(() => document.find('a'), /no such shape: a/);
});

test('文档快照深拷贝画布、属性、文字和嵌套结构，重复恢复不污染快照', () => {
  const document = new SvgDocument(400, 300);
  document.setRootAttributes({ viewBox: '0 0 400 300' });
  document.insert(new Group('g'));
  document.insert(factory.create('text', 't', ['10', '20', '原文']), 'g');
  const snapshot = document.clone();
  document.resize(800, 600); document.find('t').set('text', '修改'); document.delete('g');
  document.restore(snapshot);
  assert.equal(document.width, 400); assert.equal(document.height, 300);
  assert.equal(document.attributes.viewBox, '0 0 400 300');
  assert.equal(document.find('t').text, '原文');
  assert.equal(document.parentLabel(document.find('t')), 'g#g');
  document.find('t').set('text', '再次修改');
  document.restore(snapshot);
  assert.equal(document.find('t').text, '原文');
  assert.equal(snapshot.find('t').text, '原文');
});

test('画布尺寸必须为正数，失败的尺寸修改不改变已有尺寸', () => {
  assert.throws(() => new SvgDocument(0, 600), /canvas width must be positive/);
  const document = new SvgDocument();
  assert.throws(() => document.resize(100, -1), /canvas height must be positive/);
  assert.equal(document.width, 800); assert.equal(document.height, 600);
});
