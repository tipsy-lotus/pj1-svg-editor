import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AttributeRegistry } from '../src/extensions/AttributeRegistry.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { DefaultDispatcher } from '../src/host/DefaultDispatcher.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { SetCommand } from '../src/commands/SetCommand.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { SampleAttributeHandler } from './support/SampleAttributeHandler.js';

function fixture() {
  const registry = new AttributeRegistry();
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new DefaultDispatcher(session, new DefaultShapes(), registry);
  cli.execute('init'); cli.execute('create g group');
  cli.execute('create rect a 0 0 10 10 red in group');
  cli.execute('create rect b 0 0 10 10 blue in group');
  return { registry, session, cli };
}

test('无属性处理器命中时保留原白名单，未定义属性报错', () => {
  const { cli, session } = fixture();
  assert.deepEqual(cli.execute('set a fill green'), ['rect#a updated: fill="green"']);
  assert.equal(session.document.find('a').attributes.fill, 'green');
  assert.deepEqual(cli.execute('set a label title'), ['error: unknown attribute: label']);
});

test('一次属性处理修改多个子部件，单次撤销和重做整体恢复', () => {
  const { registry, cli, session } = fixture(); registry.register(new SampleAttributeHandler());
  assert.deepEqual(cli.execute('set group theme orange'), ['theme applied']);
  for (const id of ['a', 'b']) assert.equal(session.document.find(id).attributes.fill, 'orange');
  cli.execute('undo');
  assert.equal(session.document.find('a').attributes.fill, 'red');
  assert.equal(session.document.find('b').attributes.fill, 'blue');
  cli.execute('redo');
  for (const id of ['a', 'b']) assert.equal(session.document.find(id).attributes.fill, 'orange');
});

test('部分修改后失败时整体回滚，不落入默认 fill，也不改变两边历史', () => {
  const { registry, cli, session } = fixture();
  cli.execute('set a stroke black'); cli.execute('undo');
  registry.register(new SampleAttributeHandler('failing', true, 'fill'));
  const before = session.document.clone();
  assert.deepEqual(cli.execute('set group fill orange'), ['error: handler failed after first edit']);
  assert.deepEqual(session.document, before);
  cli.execute('redo'); assert.equal(session.document.find('a').attributes.stroke, 'black');
  cli.execute('undo'); cli.execute('undo');
  assert.throws(() => session.document.find('b'), /no such shape/);
});

test('多个处理器命中时拒绝全部执行，重复注册不覆盖原项', () => {
  const { registry, cli, session } = fixture();
  registry.register(new SampleAttributeHandler('a'));
  assert.throws(() => registry.register(new SampleAttributeHandler('a')), /duplicate registration: attributes\/a/);
  registry.register(new SampleAttributeHandler('b'));
  const before = session.document.clone();
  assert.deepEqual(cli.execute('set group theme orange'), ['error: conflicting attribute handlers: theme (a, b)']);
  assert.deepEqual(session.document, before);
  cli.execute('undo'); assert.throws(() => session.document.find('b'), /no such shape/);
});

test('处理器非法注册和 handles 抛错均不会产生成功历史', () => {
  const { registry, session } = fixture();
  assert.throws(() => registry.register({ name: '', handles: () => true, apply: () => {} }), /invalid attribute handler/);
  const broken = new SampleAttributeHandler(); broken.handles = () => { throw new Error('bad predicate'); };
  registry.register(broken);
  const before = session.document.clone();
  assert.throws(() => session.execute(new SetCommand('group', 'theme', 'green', registry)), /bad predicate/);
  assert.deepEqual(session.document, before);
  session.undo(); assert.throws(() => session.document.find('b'), /no such shape/);
});
