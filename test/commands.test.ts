import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddToCommand } from '../src/commands/AddToCommand.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';
import { DeleteCommand } from '../src/commands/DeleteCommand.js';
import { GroupCommand } from '../src/commands/GroupCommand.js';
import { History } from '../src/commands/History.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { ReorderCommand } from '../src/commands/ReorderCommand.js';
import { ScaleCommand } from '../src/commands/ScaleCommand.js';
import { SetCommand } from '../src/commands/SetCommand.js';
import { UngroupCommand } from '../src/commands/UngroupCommand.js';
import { Group } from '../src/model/Group.js';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgDocument } from '../src/model/SvgDocument.js';

const factory = new ShapeFactory();

test('初始历史禁止撤销重做，失败编辑不解除屏障，成功编辑解除', () => {
  const document = new SvgDocument(); const history = new History();
  assert.throws(() => history.undo(document), /undo not allowed after io command/);
  assert.throws(() => history.redo(document), /undo not allowed after io command/);
  assert.throws(() => history.execute(new MoveCommand('missing', 1, 2), document), /no such shape: missing/);
  assert.throws(() => history.undo(document), /undo not allowed after io command/);
  history.execute(new CreateCommand('g', 'scene', []), document);
  history.undo(document);
  assert.equal(document.all().length, 0);
  assert.throws(() => history.undo(document), /nothing to undo/);
  history.redo(document);
  assert.equal(document.find('scene').isContainer, true);
  assert.throws(() => history.redo(document), /nothing to redo/);
});

test('创建命令支持嵌套父容器，每次创建独立撤销和重做', () => {
  const document = new SvgDocument(); const history = new History();
  history.execute(new CreateCommand('g', 'scene', []), document);
  const message = history.execute(new CreateCommand('rect', 'r', ['10', '20', '30', '40', 'blue'], 'scene'), document);
  assert.equal(message, 'rect#r created in g#scene');
  assert.equal(document.parentLabel(document.find('r')), 'g#scene');
  const created = document.clone();
  history.undo(document);
  assert.equal(document.find('scene').children.length, 0);
  history.redo(document);
  assert.deepEqual(document, created);
  history.undo(document); history.undo(document);
  assert.equal(document.all().length, 0);
});

test('移动撤销精确恢复快照，多次重做不累积浮点误差', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(factory.create('rect', 'r', ['0.1', '0.2', '3', '4']));
  const before = document.clone();
  history.execute(new MoveCommand('r', 0.2, -0.1), document);
  const after = document.clone();
  assert.equal(document.find('r').attributes.x, String(0.1 + 0.2));
  for (let index = 0; index < 5; index++) {
    history.undo(document); assert.deepEqual(document, before);
    history.redo(document); assert.deepEqual(document, after);
  }
});

test('缩放命令整体变换嵌套组，撤销同时恢复所有后代', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('outer')); document.insert(new Group('inner'), 'outer');
  document.insert(factory.create('circle', 'c', ['1', '2', '3', 'red']), 'inner');
  document.insert(factory.create('text', 't', ['4', '5', '文字']), 'outer');
  const before = document.clone();
  history.execute(new ScaleCommand('outer', 2), document);
  assert.deepEqual(document.find('c').attributes, { cx: '2', cy: '4', r: '6', fill: 'red' });
  assert.deepEqual(document.find('t').attributes, { x: '8', y: '10' });
  const after = document.clone();
  history.undo(document); assert.deepEqual(document, before);
  history.redo(document); assert.deepEqual(document, after);
});

test('设置命令可撤销文字和分组样式，不覆盖子元素显式颜色', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('g'));
  document.insert(factory.create('rect', 'r', ['1', '2', '3', '4', 'blue']), 'g');
  document.insert(factory.create('text', 't', ['1', '2', '原文']), 'g');
  const original = document.clone();
  history.execute(new SetCommand('t', 'text', '新文字 & <标签> 😀'), document);
  const textChanged = document.clone();
  history.execute(new SetCommand('g', 'fill', 'red'), document);
  assert.equal(document.find('g').attributes.fill, 'red');
  assert.equal(document.find('r').attributes.fill, 'blue');
  history.undo(document); assert.deepEqual(document, textChanged);
  history.undo(document); assert.deepEqual(document, original);
  history.redo(document);
  assert.equal(document.find('t').text, '新文字 & <标签> 😀');
});

test('跨父级分组是一个撤销单元，恢复原父级和绘制顺序', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('left')); document.insert(new Group('right'));
  document.insert(factory.create('rect', 'a', ['1', '2', '3', '4']), 'left');
  document.insert(factory.create('circle', 'b', ['5', '6', '7']), 'right');
  document.insert(new Group('tail'));
  const before = document.clone();
  history.execute(new GroupCommand('both', ['b', 'a']), document);
  assert.deepEqual(document.children.map(shape => shape.id), ['left', 'right', 'tail', 'both']);
  assert.deepEqual(document.find('both').children.map(shape => shape.id), ['a', 'b']);
  const after = document.clone();
  history.undo(document); assert.deepEqual(document, before);
  assert.throws(() => history.undo(document), /nothing to undo/);
  history.redo(document); assert.deepEqual(document, after);
});

test('删除包含后代的分组后，一次撤销恢复属性、层级和位置', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('before')); document.insert(new Group('g')); document.insert(new Group('after'));
  document.insert(new Group('inner'), 'g');
  document.insert(factory.create('text', 't', ['10', '20', '保留文字']), 'inner');
  const before = document.clone();
  history.execute(new DeleteCommand('g'), document);
  assert.deepEqual(document.all().map(shape => shape.id), ['before', 'after']);
  history.undo(document); assert.deepEqual(document, before);
  history.redo(document);
  assert.throws(() => document.find('t'), /no such shape: t/);
});

test('解组命令在原位置展开子元素，撤销恢复组和子元素顺序', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('scene')); document.insert(new Group('before'), 'scene');
  document.insert(new Group('g'), 'scene'); document.insert(new Group('after'), 'scene');
  document.insert(new Group('a'), 'g'); document.insert(new Group('b'), 'g');
  const before = document.clone();
  history.execute(new UngroupCommand('g'), document);
  assert.deepEqual(document.find('scene').children.map(shape => shape.id), ['before', 'a', 'b', 'after']);
  const after = document.clone();
  history.undo(document); assert.deepEqual(document, before);
  history.redo(document); assert.deepEqual(document, after);
});

test('移入命令将元素放到容器末尾，撤销恢复原父级位置', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('a')); document.insert(new Group('b')); document.insert(new Group('target'));
  document.insert(new Group('existing'), 'target');
  const before = document.clone();
  history.execute(new AddToCommand('target', 'a'), document);
  assert.deepEqual(document.find('target').children.map(shape => shape.id), ['existing', 'a']);
  history.undo(document); assert.deepEqual(document, before);
  history.redo(document);
  assert.equal(document.parentLabel(document.find('a')), 'g#target');
});

for (const front of [true, false]) {
  test(`${front ? '前置' : '后置'}命令可以精确撤销重做，不影响其他父级`, () => {
    const document = new SvgDocument(); const history = new History();
    document.insert(new Group('scene')); document.insert(new Group('outside'));
    for (const id of ['a', 'b', 'c']) document.insert(new Group(id), 'scene');
    const before = document.clone();
    history.execute(new ReorderCommand('b', front), document);
    assert.deepEqual(document.find('scene').children.map(shape => shape.id), front ? ['a', 'c', 'b'] : ['b', 'a', 'c']);
    assert.deepEqual(document.children.map(shape => shape.id), ['scene', 'outside']);
    const after = document.clone();
    history.undo(document); assert.deepEqual(document, before);
    history.redo(document); assert.deepEqual(document, after);
  });
}

test('连续编辑按相反顺序撤销，再按原顺序重做', () => {
  const document = new SvgDocument(); const history = new History();
  const states = [document.clone()];
  for (const command of [
    new CreateCommand('rect', 'r', ['1', '2', '3', '4']),
    new MoveCommand('r', 10, 20), new SetCommand('r', 'fill', 'red'), new DeleteCommand('r'),
  ]) {
    history.execute(command, document); states.push(document.clone());
  }
  for (let index = states.length - 2; index >= 0; index--) {
    history.undo(document); assert.deepEqual(document, states[index]);
  }
  assert.throws(() => history.undo(document), /nothing to undo/);
  for (let index = 1; index < states.length; index++) {
    history.redo(document); assert.deepEqual(document, states[index]);
  }
  assert.throws(() => history.redo(document), /nothing to redo/);
});

test('撤销后成功的新编辑清空重做栈', () => {
  const document = new SvgDocument(); const history = new History();
  history.execute(new CreateCommand('g', 'a', []), document);
  history.execute(new CreateCommand('g', 'b', []), document);
  history.undo(document);
  history.execute(new CreateCommand('g', 'c', []), document);
  assert.throws(() => history.redo(document), /nothing to redo/);
  assert.deepEqual(document.children.map(shape => shape.id), ['a', 'c']);
  history.undo(document);
  assert.deepEqual(document.children.map(shape => shape.id), ['a']);
});

test('撤销后的失败编辑不改变文档，也不清空原有重做记录', () => {
  const document = new SvgDocument(); const history = new History();
  history.execute(new CreateCommand('rect', 'r', ['1', '2', '3', '4']), document);
  history.execute(new MoveCommand('r', 10, 20), document);
  const moved = document.clone();
  history.undo(document);
  const before = document.clone();
  for (const command of [
    new CreateCommand('rect', 'r', ['1', '2', '3', '4']),
    new CreateCommand('box', 'bad', []), new CreateCommand('g', 'bad', [], 'missing'),
    new CreateCommand('g', 'bad', [], 'r'), new ScaleCommand('r', 0),
    new SetCommand('r', 'text', 'wrong'), new DeleteCommand('missing'),
  ]) {
    assert.throws(() => history.execute(command, document));
    assert.deepEqual(document, before);
  }
  history.redo(document); assert.deepEqual(document, moved);
});

test('组缩放中途数值溢出时恢复已修改的前序元素，保留历史', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('g'));
  document.insert(factory.create('rect', 'small', ['1', '2', '3', '4']), 'g');
  document.insert(factory.create('rect', 'huge', ['1e308', '2', '3', '4']), 'g');
  const original = document.clone();
  history.execute(new SetCommand('small', 'fill', 'blue'), document);
  const before = document.clone();
  assert.throws(() => history.execute(new ScaleCommand('g', 2), document), /invalid number: Infinity/);
  assert.deepEqual(document, before);
  history.undo(document); assert.deepEqual(document, original);
  history.redo(document); assert.deepEqual(document, before);
});

test('非法结构编辑不破坏层级或之前的撤销记录', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(new Group('outer')); document.insert(new Group('inner'), 'outer');
  const original = document.clone();
  history.execute(new CreateCommand('g', 'child', [], 'inner'), document);
  const before = document.clone();
  for (const command of [
    new GroupCommand('bad', ['outer', 'child']), new AddToCommand('inner', 'outer'),
    new UngroupCommand('outer'), new GroupCommand('bad', ['child', 'child']),
  ]) {
    assert.throws(() => history.execute(command, document));
    assert.deepEqual(document, before);
  }
  history.undo(document); assert.deepEqual(document, original);
});

test('历史屏障清空两栈，新编辑后不能撤销到屏障以前', () => {
  const document = new SvgDocument(); const history = new History();
  history.execute(new CreateCommand('g', 'a', []), document);
  history.execute(new CreateCommand('g', 'b', []), document); history.undo(document);
  history.barrier();
  const barrierState = document.clone();
  assert.throws(() => history.undo(document), /undo not allowed after io command/);
  assert.throws(() => history.redo(document), /undo not allowed after io command/);
  assert.throws(() => history.execute(new DeleteCommand('missing'), document), /no such shape/);
  assert.throws(() => history.undo(document), /undo not allowed after io command/);
  history.execute(new CreateCommand('g', 'c', []), document);
  history.undo(document); assert.deepEqual(document, barrierState);
  assert.throws(() => history.undo(document), /nothing to undo/);
  history.redo(document);
  assert.deepEqual(document.children.map(shape => shape.id), ['a', 'c']);
});

test('未执行的命令不能直接撤销或重做', () => {
  const document = new SvgDocument(); const command = new CreateCommand('g', 'g', []);
  assert.throws(() => command.undo(document), /command has not executed/);
  assert.throws(() => command.redo(document), /command has not executed/);
  assert.equal(document.all().length, 0);
});

test('同一个命令对象不能重复执行，以免覆盖历史快照', () => {
  const document = new SvgDocument(); const history = new History();
  document.insert(factory.create('rect', 'r', ['1', '2', '3', '4']));
  const original = document.clone();
  const command = new MoveCommand('r', 1, 2);
  history.execute(command, document);
  const moved = document.clone();
  assert.throws(() => history.execute(command, document), /command has already executed/);
  assert.deepEqual(document, moved);
  history.undo(document); assert.deepEqual(document, original);
  history.redo(document); assert.deepEqual(document, moved);
});
