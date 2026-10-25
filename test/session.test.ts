import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorSession } from '../src/application/EditorSession.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { SvgFileRepository } from '../src/io/SvgFileRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';

test('没有当前文档时，编辑、显示尺寸、保存及历史操作统一拒绝', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore()));
  for (const operation of [
    () => session.document, () => session.canvas(), () => session.save(),
    () => session.undo(), () => session.redo(), () => session.execute(new CreateCommand('g', 'g', [])),
  ]) assert.throws(operation, { message: "no document. use 'init' or 'read' first" });
});

test('初始化支持默认尺寸，重新初始化清空内容、路径和历史', () => {
  const files = new MemoryFileStore(); const session = new EditorSession(new SvgFileRepository(files));
  assert.equal(session.init(), 'canvas 800x600 created');
  session.execute(new CreateCommand('g', 'old', [])); session.save('old.svg'); session.read('old.svg');
  session.init(400, 300);
  assert.equal(session.document.width, 400); assert.equal(session.document.height, 300);
  assert.equal(session.document.all().length, 0); assert.equal(session.currentPath, undefined);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.save(), /no read path/);
});

test('初始化失败保留原文档、路径和重做记录', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore()));
  session.init(); session.execute(new CreateCommand('g', 'g', [])); session.save('keep.svg'); session.read('keep.svg');
  session.execute(new CreateCommand('g', 'later', [])); session.undo();
  const snapshot = session.document.clone();
  assert.throws(() => session.init(100, 0), /canvas height must be positive/);
  assert.deepEqual(session.document, snapshot); assert.equal(session.currentPath, 'keep.svg');
  session.redo(); assert.equal(session.document.find('later').id, 'later');
});

test('读取成功更新文档和路径，警告先于摘要返回，建立历史屏障', () => {
  const files = new MemoryFileStore(); files.put('new.svg', '<svg width="400" height="300"><rect/></svg>');
  const session = new EditorSession(new SvgFileRepository(files));
  session.init(); session.execute(new CreateCommand('g', 'old', []));
  assert.deepEqual(session.read('new.svg'), ['warning: assigned id rect1 to unnamed <rect>', 'read new.svg (1 elements)']);
  assert.equal(session.document.width, 400); assert.equal(session.currentPath, 'new.svg');
  assert.throws(() => session.document.find('old'), /no such shape/);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
});

test('首次读取即可建立文档，未初始化也可使用 read', () => {
  const files = new MemoryFileStore(); files.put('a.svg', '<svg><g id="g"/></svg>');
  const session = new EditorSession(new SvgFileRepository(files)); session.read('a.svg');
  assert.equal(session.document.find('g').id, 'g');
});

test('文件缺失或内容非法时，读取失败不改变已有文档、路径和重做栈', () => {
  const files = new MemoryFileStore(); files.put('bad.svg', '<svg><rect/><circle r="-1"/></svg>');
  const session = new EditorSession(new SvgFileRepository(files));
  session.init(); session.execute(new CreateCommand('g', 'g', [])); session.save('original.svg'); session.read('original.svg');
  session.execute(new CreateCommand('g', 'future', [])); session.undo();
  const before = session.document.clone();
  for (const path of ['missing.svg', 'bad.svg']) {
    assert.throws(() => session.read(path));
    assert.deepEqual(session.document, before); assert.equal(session.currentPath, 'original.svg');
  }
  session.redo(); assert.equal(session.document.find('future').id, 'future');
});

test('读取失败时原有的历史屏障也保持不变', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); session.init();
  assert.throws(() => session.read('missing.svg'), /cannot read file/);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
});

test('无参数保存始终使用读入路径，显式另存不切换默认路径', () => {
  const files = new MemoryFileStore(); files.put('source.svg', '<svg><rect id="r"/></svg>');
  const session = new EditorSession(new SvgFileRepository(files)); session.read('source.svg');
  session.execute(new MoveCommand('r', 10, 20));
  assert.equal(session.save(), 'saved to source.svg (1 elements)');
  assert.match(files.read('source.svg'), /x="10"/);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.save('copy.svg'); assert.equal(session.currentPath, 'source.svg');
  session.execute(new MoveCommand('r', 1, 2)); session.save();
  assert.match(files.read('copy.svg'), /x="10"/);
  assert.match(files.read('source.svg'), /x="11"/);
});

test('新建文档无参数保存失败，不改变原有可撤销编辑', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore()));
  session.init(); session.execute(new CreateCommand('g', 'g', []));
  const before = session.document.clone();
  assert.throws(() => session.save(), /no read path/); assert.deepEqual(session.document, before);
  session.undo(); assert.equal(session.document.all().length, 0);
});

test('另存失败不切换默认路径，不清空重做记录', () => {
  const files = new MemoryFileStore(); files.blockWrite('blocked.svg');
  const session = new EditorSession(new SvgFileRepository(files));
  session.init(); session.save('original.svg'); session.read('original.svg');
  session.execute(new CreateCommand('g', 'g', [])); session.undo();
  const before = session.document.clone();
  assert.throws(() => session.save('blocked.svg'), /cannot write file: blocked.svg/);
  assert.deepEqual(session.document, before); assert.equal(session.currentPath, 'original.svg');
  session.redo(); assert.equal(session.document.find('g').id, 'g');
});

test('画布查询不影响历史，成功修改尺寸建立屏障，失败修改保持状态', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore()));
  session.init(); session.execute(new CreateCommand('g', 'g', [])); session.undo();
  assert.equal(session.canvas(), 'canvas 800x600');
  session.redo();
  assert.throws(() => session.canvas(100, -1), /canvas height must be positive/);
  assert.throws(() => session.canvas(100), /usage: canvas/);
  assert.equal(session.document.width, 800);
  session.undo(); assert.equal(session.document.all().length, 0);
  session.canvas(400, 300);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
  session.execute(new CreateCommand('g', 'new', [])); session.undo();
  assert.equal(session.document.width, 400); assert.equal(session.document.height, 300);
  assert.throws(() => session.undo(), /nothing to undo/);
});

test('新建文档显式保存后仍无读入路径，无参数保存失败不影响编辑和历史', () => {
  const files = new MemoryFileStore(); const session = new EditorSession(new SvgFileRepository(files));
  session.init(); session.execute(new CreateCommand('rect', 'r', ['1', '2', '3', '4']));
  session.save('created.svg'); assert.equal(session.currentPath, undefined);
  session.execute(new MoveCommand('r', 5, 0));
  const before = session.document.clone();
  assert.throws(() => session.save(), /no read path/);
  assert.deepEqual(session.document, before);
  assert.match(files.read('created.svg'), /x="1"/);
  session.undo(); assert.equal(session.document.find('r').attributes.x, '1');
});

test('再次成功 read 后，无参数保存改用新文档的读入路径', () => {
  const files = new MemoryFileStore();
  files.put('a.svg', '<svg><rect id="r" x="1"/></svg>');
  files.put('b.svg', '<svg><rect id="r" x="20"/></svg>');
  const session = new EditorSession(new SvgFileRepository(files));
  session.read('a.svg'); session.save('copy.svg'); session.read('b.svg');
  session.execute(new MoveCommand('r', 5, 0));
  assert.equal(session.save(), 'saved to b.svg (1 elements)');
  assert.equal(session.currentPath, 'b.svg');
  assert.match(files.read('b.svg'), /x="25"/);
  assert.match(files.read('a.svg'), /x="1"/);
  assert.match(files.read('copy.svg'), /x="1"/);
});
