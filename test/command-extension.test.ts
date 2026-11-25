import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { DefaultDispatcher } from '../src/host/DefaultDispatcher.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { SampleCommand } from './support/SampleCommand.js';

test('命令注册表缺省为空，注册类实例后可以调用并检查参数', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new CommandDispatcher(session, new DefaultShapes());
  assert.deepEqual(cli.context.commands(), []);
  assert.deepEqual(cli.execute('echo hello'), ['error: unknown command: echo']);
  cli.register(new SampleCommand());
  assert.deepEqual(cli.execute('echo "hello world"'), ['hello world']);
  assert.deepEqual(cli.execute('echo'), ['error: usage: echo <text>']);
  assert.deepEqual(cli.execute('echo a b'), ['error: usage: echo <text>']);
});

test('插件命令无需 SVG 文档；help 反映当前注册集合', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new DefaultDispatcher(session, new DefaultShapes());
  assert.ok(!cli.execute('help').includes('echo <text>'));
  cli.register(new SampleCommand());
  assert.ok(cli.execute('help').includes('echo <text>'));
  assert.deepEqual(cli.execute('echo ready'), ['ready']);
  assert.throws(() => session.document, /no document/);
});

test('查询型命令不改变文档与重做历史；重复注册拒绝且不覆盖', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new DefaultDispatcher(session, new DefaultShapes());
  cli.register(new SampleCommand());
  cli.execute('init'); cli.execute('create g g'); cli.execute('undo');
  const before = session.document.clone();
  assert.deepEqual(cli.execute('echo ok'), ['ok']);
  assert.deepEqual(session.document, before);
  assert.throws(() => cli.register(new SampleCommand()), /duplicate registration: commands\/echo/);
  assert.deepEqual(cli.execute('echo still'), ['still']);
  cli.execute('redo'); assert.equal(session.document.find('g').id, 'g');
});

test('错误注册不留下命令，命令抛错后仍可执行后续命令', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new CommandDispatcher(session, new DefaultShapes());
  assert.throws(() => cli.register({ ...new SampleCommand(), minimum: -1, run: () => '' }), /invalid command/);
  assert.equal(cli.context.commands().length, 0);
  const failing = new SampleCommand(); failing.run = () => { throw new Error('test failure'); };
  cli.register(failing);
  assert.deepEqual(cli.execute('echo x'), ['error: test failure']);
  cli.register({ name: 'ok', syntax: 'ok', minimum: 0, maximum: 0, run: () => 'ready' });
  assert.deepEqual(cli.execute('ok'), ['ready']);
});
