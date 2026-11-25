import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginHost } from '../src/host/PluginHost.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { SampleCommand } from './support/SampleCommand.js';
import { SampleShapeProvider } from './support/SampleShapeProvider.js';
import { SampleAttributeHandler } from './support/SampleAttributeHandler.js';
import { SampleTreeDecorator } from './support/SampleTreeDecorator.js';
import type { PluginContext } from '../src/extensions/PluginContext.js';
import { BuiltinCommandsPlugin } from '../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { BuiltinShapesPlugin } from '../plugins/builtin-shapes/src/BuiltinShapesPlugin.js';
import { readFileSync } from 'node:fs';

function host() { return new PluginHost(new EditorSession(new DefaultRepository(new MemoryFileStore()))); }

test('四类贡献暂存后一起发布，options 原样传入，运行时上下文可见已提交能力', async () => {
  const runtime = host(); const options = { color: 'red' };
  const errors = await runtime.activate({ activate(context, actual) {
    assert.equal(actual, options);
    context.registerShape(new SampleShapeProvider()); context.registerCommand(new SampleCommand());
    context.registerAttribute(new SampleAttributeHandler()); context.registerDecorator(new SampleTreeDecorator('tag', '*'));
    assert.equal(runtime.shapes.entries.length, 0);
    assert.equal(runtime.dispatcher.context.commands().length, 0);
    assert.equal('register' in context.shapes, false);
    assert.equal('register' in context.attributes, false);
  } }, { name: 'all', contributes: { shapes: ['panel'], commands: ['echo'], attributes: ['sample'], decorators: ['tag'] } }, options);
  assert.deepEqual(errors, []);
  assert.equal(runtime.shapes.entries.length, 1); assert.equal(runtime.attributes.entries.length, 1);
  assert.equal(runtime.decorators.entries.length, 1); assert.deepEqual(runtime.dispatcher.execute('echo ok'), ['ok']);
});

test('清单不一致丢弃全部贡献，包括未声明的类别', async () => {
  const runtime = host();
  const errors = await runtime.activate({ activate(context) {
    context.registerCommand(new SampleCommand()); context.registerShape(new SampleShapeProvider());
  } }, { name: 'bad', contributes: { commands: ['echo'] } });
  assert.match(errors[0]!, /^error: plugin manifest mismatch: bad \(declared:/);
  assert.equal(runtime.shapes.entries.length, 0); assert.equal(runtime.dispatcher.context.commands().length, 0);
});

test('异步激活部分注册后抛错，保留已成功插件并继续加载', async () => {
  const runtime = host();
  await runtime.activate({ activate: ctx => ctx.registerCommand(new SampleCommand()) }, { name: 'good', contributes: { commands: ['echo'] } });
  assert.deepEqual(await runtime.activate({ async activate(ctx) {
    ctx.registerShape(new SampleShapeProvider()); await Promise.resolve(); throw new Error('broken');
  } }, { name: 'bad' }), ['error: plugin failed to activate: bad (broken)']);
  assert.equal(runtime.shapes.entries.length, 0); assert.deepEqual(runtime.dispatcher.execute('echo ok'), ['ok']);
  assert.deepEqual(await runtime.activate({ activate() {} }, { name: 'next' }), []);
});

test('重复注册拒绝当前整包，即使插件捕获错误也不能发布其余贡献', async () => {
  const runtime = host();
  await runtime.activate({ activate: ctx => ctx.registerCommand(new SampleCommand()) }, { name: 'first', contributes: { commands: ['echo'] } });
  const errors = await runtime.activate({ activate(ctx) {
    ctx.registerShape(new SampleShapeProvider());
    try { ctx.registerCommand(new SampleCommand()); } catch { /* 故意模拟插件吞错 */ }
  } }, { name: 'duplicate', contributes: { shapes: ['panel'] } });
  assert.deepEqual(errors, ['error: duplicate registration: commands/echo']);
  assert.equal(runtime.shapes.entries.length, 0); assert.deepEqual(runtime.dispatcher.execute('echo ok'), ['ok']);
});

test('同包重复注册也失败，激活结束后不可追加注册', async () => {
  const runtime = host(); let saved: PluginContext | undefined;
  const errors = await runtime.activate({ activate(ctx) {
    ctx.registerCommand(new SampleCommand()); ctx.registerCommand(new SampleCommand());
  } }, { name: 'duplicate' });
  assert.deepEqual(errors, ['error: duplicate registration: commands/echo']);
  await runtime.activate({ activate(ctx) { saved = ctx; } }, { name: 'empty' });
  assert.throws(() => saved!.registerCommand(new SampleCommand()), /registration is closed/);
  assert.equal(runtime.dispatcher.context.commands().length, 0);
});

test('实际内置插件从 package.json 清单装配，help 能读到已提交图形', async () => {
  const runtime = host();
  for (const [plugin, name] of [[new BuiltinShapesPlugin(), 'builtin-shapes'], [new BuiltinCommandsPlugin(), 'builtin-commands']] as const) {
    const manifest = JSON.parse(readFileSync(`plugins/${name}/package.json`, 'utf8'));
    assert.deepEqual(await runtime.activate(plugin, manifest), []);
  }
  assert.ok(runtime.dispatcher.execute('help').includes('  g <id>'));
  assert.deepEqual(runtime.dispatcher.execute('init'), ['canvas 800x600 created']);
  assert.deepEqual(runtime.dispatcher.execute('create g g'), ['g#g created']);
});

test('并发加载请求按调用顺序串行执行，后一个能检测前一个注册', async () => {
  const runtime = host();
  const first = runtime.activate({ async activate(ctx) { await Promise.resolve(); ctx.registerCommand(new SampleCommand()); } }, { name: 'first', contributes: { commands: ['echo'] } });
  const second = runtime.activate({ activate(ctx) { ctx.registerCommand(new SampleCommand()); } }, { name: 'second', contributes: { commands: ['echo'] } });
  assert.deepEqual(await first, []);
  assert.deepEqual(await second, ['error: duplicate registration: commands/echo']);
});
