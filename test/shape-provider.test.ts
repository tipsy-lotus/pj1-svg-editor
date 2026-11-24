import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Group } from '../src/model/Group.js';
import { Rect } from '../src/model/Rect.js';
import { SvgCodec } from '../src/io/SvgCodec.js';
import { SvgFileRepository } from '../src/io/SvgFileRepository.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { CreateCommand } from '../src/commands/CreateCommand.js';
import { History } from '../src/commands/History.js';
import { BuiltinShapesPlugin } from '../plugins/builtin-shapes/src/BuiltinShapesPlugin.js';
import type { ShapeProvider } from '../src/extensions/ShapeProvider.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { SampleShapeProvider } from './support/SampleShapeProvider.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';

test('内核空注册表可以启动，不会偷偷装入内置图形', () => {
  const shapes = new ShapeFactory();
  const cli = new CommandDispatcher(new EditorSession(new SvgFileRepository(new MemoryFileStore(), new SvgCodec(shapes))), shapes);
  assert.deepEqual(shapes.help, []);
  assert.equal(cli.execute('init')[0], 'canvas 800x600 created');
  assert.match(cli.execute('create rect r 1 2 3 4')[0]!, /unknown shape type: rect/);
  assert.equal(cli.execute('quit')[0], 'bye');
});

test('内置图形插件只经注册接口提供六个类实例，禁用时没有贡献', () => {
  const providers: ShapeProvider[] = [];
  new BuiltinShapesPlugin().activate({ registerShape: provider => providers.push(provider) });
  assert.deepEqual(providers.map(provider => provider.name), ['rect', 'circle', 'ellipse', 'line', 'text', 'g']);
  assert.ok(providers.every(provider => provider.constructor !== Object));
  const shapes = new ShapeFactory();
  providers.forEach(provider => shapes.register(provider));
  assert.equal(shapes.create('rect', 'r', ['1', '2', '3', '4']).attributes.width, '3');
  assert.equal(shapes.help.length, 6);
});

test('拒绝同名注册，原提供器保持可用', () => {
  const shapes = new DefaultShapes();
  assert.throws(() => new BuiltinShapesPlugin().activate({ registerShape: provider => shapes.register(provider) }), /duplicate registration: shapes\/rect/);
  assert.equal(shapes.create('rect', 'r', ['1', '2', '3', '4']).tag, 'rect');
  const invalid = new SampleShapeProvider('invalid', NaN);
  assert.throws(() => shapes.register(invalid), /invalid shape provider/);
  assert.throws(() => shapes.create('invalid', 'r', []), /unknown shape type/);
});

test('自定义提供器接入 create 与撤销重做，未注册时仍报未知类型', () => {
  const shapes = new ShapeFactory();
  shapes.register(new SampleShapeProvider());
  const document = new SvgDocument(); const history = new History();
  history.execute(new CreateCommand(shapes, 'panel', 'p', []), document);
  assert.equal(document.find('p').attributes['data-kind'], 'panel');
  history.undo(document); assert.equal(document.all().length, 0);
  history.redo(document); assert.equal(document.find('p').attributes['data-kind'], 'panel');
  assert.throws(() => new DefaultShapes().create('panel', 'p', []), /unknown shape type: panel/);
});

test('子树先解析再交给提供器；更具体的读回优先，未注册时保留普通分组', () => {
  const source = '<svg><g id="p" data-kind="panel"><rect id="r"/></g></svg>';
  const shapes = new DefaultShapes(); shapes.register(new SampleShapeProvider());
  const result = new SvgCodec(shapes).decode(source).document;
  assert.equal(result.find('p').attributes['data-restored'], 'panel');
  assert.equal(result.find('p').children[0]!.id, 'r');
  const fallback = new SvgCodec(new DefaultShapes()).decode(source).document;
  assert.equal(fallback.find('p').attributes['data-kind'], 'panel');
  assert.equal(fallback.find('p').attributes['data-restored'], undefined);
});

test('读回最高优先级并列时拒绝，不受注册顺序影响', () => {
  for (const providers of [[new SampleShapeProvider('a'), new SampleShapeProvider('b')],
    [new SampleShapeProvider('b'), new SampleShapeProvider('a')]]) {
    const shapes = new ShapeFactory(); providers.forEach(provider => shapes.register(provider));
    assert.throws(() => shapes.fromSvg({ tag: 'g', id: 'p', attributes: { 'data-kind': 'panel' }, children: [new Rect('r')], text: '' }), /ambiguous shape providers/);
  }
});

test('提供器拒绝残缺子树时 read 保留原文档与重做历史', () => {
  const shapes = new DefaultShapes(); shapes.register(new SampleShapeProvider());
  const files = new MemoryFileStore(); files.write('bad.svg', '<svg><g id="p" data-kind="panel"/></svg>');
  const session = new EditorSession(new SvgFileRepository(files, new SvgCodec(shapes)));
  session.init(); session.execute(new CreateCommand(shapes, 'g', 'old', [])); session.undo();
  assert.throws(() => session.read('bad.svg'), /panel requires at least one child/);
  assert.equal(session.document.all().length, 0);
  session.redo(); assert.equal(session.document.find('old').id, 'old');
});

test('提供器返回错误 ID 时创建失败且不污染文档和历史', () => {
  const shapes = new ShapeFactory();
  const provider = new SampleShapeProvider();
  provider.create = () => new Group('wrong');
  shapes.register(provider);
  const history = new History(); const document = new SvgDocument();
  assert.throws(() => history.execute(new CreateCommand(shapes, 'panel', 'p', []), document), /shape provider returned invalid shape: p/);
  assert.equal(document.all().length, 0);
  assert.throws(() => history.undo(document), /undo not allowed after io command/);
});
