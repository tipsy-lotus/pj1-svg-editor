import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeFormatter } from '../src/cli/ShapeFormatter.js';
import { TreeDecoratorRegistry } from '../src/extensions/TreeDecoratorRegistry.js';
import { AttributeRegistry } from '../src/extensions/AttributeRegistry.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { DefaultDispatcher } from '../src/host/DefaultDispatcher.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { SampleTreeDecorator } from './support/SampleTreeDecorator.js';

function document() {
  const shapes = new DefaultShapes(); const document = new SvgDocument();
  document.insert(shapes.create('g', 'g', []));
  document.insert(shapes.create('text', 't', ['1', '2', 'hello']), 'g');
  return document;
}

test('未注册装饰器的 tree 与原格式一致，没有尾部空格', () => {
  assert.equal(new ShapeFormatter().tree(document()), 'svg (800x600)\n└── g#g\n    └── text#t  x=1 y=2 "hello"');
});

test('独立装饰器按注册顺序拼接，覆盖根行、容器和叶子', () => {
  const registry = new TreeDecoratorRegistry();
  registry.register(new SampleTreeDecorator('first', '(one)'));
  registry.register(new SampleTreeDecorator('second', '*', 'g'));
  assert.equal(new ShapeFormatter(registry).tree(document()), 'svg (800x600) (one)\n└── g#g (one) *\n    └── text#t  x=1 y=2 "hello" (one)');
});

test('tree 指定子树时首行仍接收目标图形，show 不追加标签', () => {
  const registry = new TreeDecoratorRegistry(); registry.register(new SampleTreeDecorator('tag', '(tag)', 'g'));
  const formatter = new ShapeFormatter(registry); const doc = document();
  assert.equal(formatter.tree(doc, 'g'), 'g#g (tag)\n└── text#t  x=1 y=2 "hello"');
  assert.equal(formatter.show(doc, 'g'), new ShapeFormatter().show(doc, 'g'));
});

test('空标签不改变输出；同名拒绝，状态保留在各实例中', () => {
  const first = new SampleTreeDecorator('empty', ''); const second = new SampleTreeDecorator('empty', '');
  const registry = new TreeDecoratorRegistry(); registry.register(first);
  assert.throws(() => registry.register(second), /duplicate registration: decorators\/empty/);
  assert.equal(new ShapeFormatter(registry).tree(document()), new ShapeFormatter().tree(document()));
  assert.equal(first.calls, 3); assert.equal(second.calls, 0);
  assert.throws(() => registry.register({ name: '', decorate: () => '' }), /invalid tree decorator/);
});

test('树展示保持文档和 redo，标签抛错后其他命令仍可用', () => {
  const registry = new TreeDecoratorRegistry();
  const decorator = new SampleTreeDecorator('tag', '*'); registry.register(decorator);
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new DefaultDispatcher(session, new DefaultShapes(), new AttributeRegistry(), registry);
  cli.execute('init'); cli.execute('create g g'); cli.execute('undo');
  const before = session.document.clone();
  assert.deepEqual(cli.execute('tree'), ['svg (800x600) *']);
  assert.deepEqual(session.document, before);
  decorator.decorate = () => { throw new Error('tag failed'); };
  assert.deepEqual(cli.execute('tree'), ['error: tag failed']);
  cli.execute('redo'); assert.equal(session.document.find('g').id, 'g');
});

test('拒绝含换行的标签，不输出半棵树', () => {
  const registry = new TreeDecoratorRegistry(); registry.register(new SampleTreeDecorator('bad', 'a\nb'));
  assert.throws(() => new ShapeFormatter(registry).tree(document()), /invalid tree decorator result: bad/);
});
