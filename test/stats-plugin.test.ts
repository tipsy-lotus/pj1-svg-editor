import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { StatsCommand } from '../plugins/stats/src/StatsCommand.js';
import { StatsPlugin } from '../plugins/stats/src/StatsPlugin.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Rect } from '../src/model/Rect.js';
import { Circle } from '../src/model/Circle.js';
import { Text } from '../src/model/Text.js';
import { Group } from '../src/model/Group.js';
import type { Command } from '../src/extensions/Command.js';
import { PluginHost } from '../src/host/PluginHost.js';
import { PluginLoader } from '../src/host/PluginLoader.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { DefaultDispatcher } from './support/DefaultDispatcher.js';

test('stats 独立注册类实例，空文档不计 SVG 根', () => {
  const commands: Command[] = [];
  new StatsPlugin().activate({ session: { document: new SvgDocument() }, registerCommand: command => commands.push(command) });
  assert.ok(commands[0] instanceof StatsCommand);
  assert.equal(commands[0]!.run(), '(total 0, containers 0)');
});

test('深度优先按首次出现的叶子类型排序，容器与内部叶子分别计数', () => {
  const document = new SvgDocument();
  const group = new Group('g'); const nested = new Group('nested');
  group.add(new Text('t')); nested.add(new Circle('c')); group.add(nested); group.add(new Rect('r'));
  document.insert(group); document.insert(new Text('second')); document.insert(new Group('empty'));
  assert.equal(new StatsCommand({ document }).run(), 'text: 2  circle: 1  rect: 1  (total 4, containers 3)');
});

test('带 data-kind 的容器照常统计，统计不依赖容器名称或其他插件', () => {
  const document = new SvgDocument(); const composite = new Group('node');
  composite.importAttributes({ 'data-kind': 'box' }); composite.add(new Rect('node-rect')); composite.add(new Text('node-label'));
  document.insert(composite);
  assert.equal(new StatsCommand({ document }).run(), 'rect: 1  text: 1  (total 2, containers 1)');
});

test('help 反映启用状态，参数规则由插件提供，无文档时报告原有错误', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore()));
  const cli = new DefaultDispatcher(session);
  assert.deepEqual(cli.execute('stats'), ['error: unknown command: stats']);
  assert.ok(!cli.execute('help').includes('stats'));
  new StatsPlugin().activate({ session, registerCommand: command => cli.register(command) });
  assert.ok(cli.execute('help').includes('stats'));
  assert.deepEqual(cli.execute('stats extra'), ['error: usage: stats']);
  assert.deepEqual(cli.execute('stats'), ["error: no document. use 'init' or 'read' first"]);
});

test('统计与文档历史隔离，保存屏障及 redo 均保持', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore())); const cli = new DefaultDispatcher(session);
  new StatsPlugin().activate({ session, registerCommand: command => cli.register(command) });
  cli.execute('init'); cli.execute('create g g'); cli.execute('save a.svg');
  const saved = session.savedDocument;
  cli.execute('stats'); assert.deepEqual(cli.execute('undo'), ['error: undo not allowed after io command']);
  cli.execute('create rect r 1 2 3 4'); cli.execute('undo');
  const before = session.document.clone();
  assert.deepEqual(cli.execute('stats'), ['(total 0, containers 1)']);
  assert.deepEqual(session.document, before); assert.deepEqual(session.savedDocument, saved);
  cli.execute('redo'); assert.equal(session.document.find('r').tag, 'rect');
});

test('代码与配置装配使用同一实现、相同 options，输出逐字节一致', async () => {
  const a = new PluginHost(new EditorSession(new DefaultRepository(new MemoryFileStore())));
  const b = new PluginHost(new EditorSession(new DefaultRepository(new MemoryFileStore())));
  // 插件只读取公开领域上下文；无需加载其他插件即可独立验证。
  a.dispatcher.context.session.init(); b.dispatcher.context.session.init();
  a.dispatcher.context.session.document.insert(new Rect('r')); b.dispatcher.context.session.document.insert(new Rect('r'));
  const manifest = JSON.parse(readFileSync('plugins/stats/package.json', 'utf8'));
  assert.deepEqual(await a.activate(new StatsPlugin(), manifest), []);
  mkdirSync('.cache', { recursive: true }); const root = mkdtempSync(resolve('.cache/stats-config-'));
  const config = join(root, 'plugins.json');
  writeFileSync(config, JSON.stringify({ plugins: [{ module: resolve('plugins/stats') }] }));
  assert.deepEqual(await new PluginLoader(b).load(config), []);
  assert.deepEqual(Buffer.from(a.dispatcher.execute('stats').join('\n')), Buffer.from(b.dispatcher.execute('stats').join('\n')));
});
