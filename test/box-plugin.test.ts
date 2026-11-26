import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Box } from '../plugins/box/src/Box.js';
import { BoxPlugin } from '../plugins/box/src/BoxPlugin.js';
import { BoxProvider } from '../plugins/box/src/BoxProvider.js';
import { BoxAttributes } from '../plugins/box/src/BoxAttributes.js';
import { BoxTypeDecorator } from '../plugins/box/src/BoxTypeDecorator.js';
import { ShapeFactory } from '../src/model/ShapeFactory.js';
import { SvgCodec } from '../src/io/SvgCodec.js';
import { SvgFileRepository } from '../src/io/SvgFileRepository.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { PluginHost } from '../src/host/PluginHost.js';
import { PluginLoader } from '../src/host/PluginLoader.js';
import { BuiltinShapesPlugin } from '../plugins/builtin-shapes/src/BuiltinShapesPlugin.js';
import { BuiltinCommandsPlugin } from '../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';

const manifest = JSON.parse(readFileSync('plugins/box/package.json', 'utf8'));
async function fixture(enable = true) {
  const shapes = new ShapeFactory(); const files = new MemoryFileStore(); const codec = new SvgCodec(shapes);
  const session = new EditorSession(new SvgFileRepository(files, codec)); const host = new PluginHost(session, shapes);
  for (const [plugin, name] of [[new BuiltinShapesPlugin(), 'builtin-shapes'], [new BuiltinCommandsPlugin(), 'builtin-commands']] as const) {
    assert.deepEqual(await host.activate(plugin, JSON.parse(readFileSync(`plugins/${name}/package.json`, 'utf8'))), []);
  }
  if (enable) assert.deepEqual(await host.activate(new BoxPlugin(), manifest), []);
  return { host, cli: host.dispatcher, session, files, codec };
}

test('box 插件无需其他插件即可注册三种类实例并创建完整结构', () => {
  const contributions: unknown[] = [];
  new BoxPlugin().activate({ registerShape: item => contributions.push(item), registerAttribute: item => contributions.push(item), registerDecorator: item => contributions.push(item) });
  assert.ok(contributions[0] instanceof BoxProvider); assert.ok(contributions[1] instanceof BoxAttributes); assert.ok(contributions[2] instanceof BoxTypeDecorator);
  const box = new BoxProvider().create('n', ['120', '100', '160', '60', '开始']);
  assert.deepEqual(box.children.map(child => child.id), ['n-rect', 'n-label']);
  assert.equal(box.children[0]!.attributes.fill, '#4a90d9');
  assert.equal(box.children[1]!.attributes.x, '140'); assert.equal(box.children[1]!.attributes.y, '135');
  assert.equal(box.children[1]!.text, '开始');
  assert.throws(() => new BoxProvider().create('n', ['1']), /usage/);
  assert.throws(() => new BoxProvider().create('n', ['0', '0', '-1', '2', 'bad']), /nonnegative/);
});

test('创建与树标签、整体移动、撤销重做、缩放均通过既有命令', async () => {
  const { cli, session } = await fixture(); cli.execute('init');
  assert.deepEqual(cli.execute('create box n 120 100 160 60 "开始"'), ['box#n created (g#n + rect#n-rect + text#n-label)']);
  assert.match(cli.execute('tree n')[0]!, /^g#n.*\(box\)/);
  cli.execute('move n 0 100'); assert.equal(session.document.find('n-label').attributes.y, '235');
  cli.execute('undo'); assert.equal(session.document.find('n-label').attributes.y, '135');
  cli.execute('redo'); assert.equal(session.document.find('n-rect').attributes.y, '200');
  assert.ok(session.document.find('n') instanceof Box);
  cli.execute('scale n 2'); assert.equal(session.document.find('n-rect').attributes.width, '320');
});

test('fill 与 label 各为一个 undo 单元，修改内部部件且不扩大普通图形白名单', async () => {
  const { cli, session } = await fixture(); cli.execute('init'); cli.execute('create box n 0 0 100 50 "old"');
  assert.deepEqual(cli.execute('set n fill orange'), ['box#n fill propagated to n-rect']);
  assert.equal(session.document.find('n-rect').attributes.fill, 'orange');
  assert.equal(session.document.find('n').attributes.fill, undefined);
  cli.execute('undo'); assert.equal(session.document.find('n-rect').attributes.fill, '#4a90d9');
  cli.execute('redo'); assert.equal(session.document.find('n-rect').attributes.fill, 'orange');
  cli.execute('set n label "new title"'); assert.equal(session.document.find('n-label').text, 'new title');
  cli.execute('undo'); assert.equal(session.document.find('n-label').text, 'old');
  cli.execute('redo'); assert.equal(session.document.find('n-label').text, 'new title');
  assert.deepEqual(cli.execute('set n-rect label nope'), ['error: unknown attribute: label']);
});

test('派生子部件 ID 冲突整条创建失败，保留原内容和 redo', async () => {
  for (const conflict of ['n', 'n-rect', 'n-label']) {
    const { cli, session } = await fixture(); cli.execute('init'); cli.execute(`create g ${conflict}`);
    cli.execute('create g future'); cli.execute('undo'); const before = session.document.clone();
    assert.match(cli.execute('create box n 0 0 100 50 title')[0]!, /id already exists/);
    assert.deepEqual(session.document, before); cli.execute('redo'); assert.equal(session.document.find('future').id, 'future');
  }
});

test('必要子部件保护、拒绝解组，整体删除可一次撤销恢复保护', async () => {
  const { cli, session } = await fixture(); cli.execute('init'); cli.execute('create g scene'); cli.execute('create box n 0 0 100 50 title in scene');
  for (const command of ['delete n-rect', 'addto scene n-label', 'group stolen n-rect', 'front n-label', 'ungroup n']) {
    const before = session.document.clone(); assert.match(cli.execute(command)[0]!, /^error:/); assert.deepEqual(session.document, before);
  }
  assert.deepEqual(cli.execute('ungroup n'), ['error: cannot ungroup composite shape: n']);
  cli.execute('delete n'); assert.equal(session.document.all().length, 1);
  cli.execute('undo'); assert.ok(session.document.find('n') instanceof Box);
  assert.match(cli.execute('delete n-label')[0]!, /cannot remove required box part/);
});

test('box 可嵌套、收编，移动递归作用于内层', async () => {
  const { cli, session } = await fixture(); cli.execute('init'); cli.execute('create box outer 0 0 100 50 outer');
  cli.execute('create box inner 10 20 50 30 inner in outer'); cli.execute('group cluster outer');
  cli.execute('move cluster 5 10'); assert.equal(session.document.find('inner-rect').attributes.y, '30');
  assert.equal(session.document.parentLabel(session.document.find('inner')), 'box#outer');
});

test('保存读回还原 box；未装插件时降级为普通 g，保留子树', async () => {
  const { cli, session, files } = await fixture(); cli.execute('init'); cli.execute('create box n 0 0 100 50 "hello"'); cli.execute('save box.svg');
  assert.match(files.read('box.svg'), /data-kind="box"/); cli.execute('read box.svg');
  assert.ok(session.document.find('n') instanceof Box);
  const fallback = await fixture(false); const result = fallback.codec.decode(files.read('box.svg')).document;
  assert.ok(!(result.find('n') instanceof Box)); assert.equal(result.find('n-label').text, 'hello');
  assert.equal(result.find('n').attributes['data-kind'], 'box');
});

test('残缺或错误类型 box 与重复 ID 均拒绝整个 read，原文档及历史保持', async () => {
  const { cli, session, files } = await fixture(); cli.execute('init'); cli.execute('create g keep'); cli.execute('create g future'); cli.execute('undo');
  for (const xml of ['<g id="n" data-kind="box"/>', '<g id="n" data-kind="box"><circle id="n-rect"/><text id="n-label"/></g>',
    '<g id="n" data-kind="box"><rect id="n-rect"/><text id="n-label"/><rect id="n-rect"/></g>']) {
    files.put('bad.svg', `<svg>${xml}</svg>`); const before = session.document.clone();
    assert.throws(() => session.read('bad.svg'), /invalid box structure|id already exists/); assert.deepEqual(session.document, before);
  }
  cli.execute('redo'); assert.equal(session.document.find('future').id, 'future');
});

test('代码与配置装配执行相同 box 会话，输出和序列化逐字节一致', async () => {
  const a = await fixture(); const b = await fixture(false);
  mkdirSync('.cache', { recursive: true }); const root = mkdtempSync(resolve('.cache/box-config-')); const config = join(root, 'plugins.json');
  writeFileSync(config, JSON.stringify({ plugins: [{ module: resolve('plugins/box') }] }));
  assert.deepEqual(await new PluginLoader(b.host).load(config), []);
  const input = ['init', 'create box n 120 100 160 60 "开始"', 'set n fill orange', 'set n label "处理数据 v2"', 'undo', 'redo', 'tree', 'save out.svg', 'read out.svg', 'tree'];
  assert.deepEqual(Buffer.from(input.flatMap(line => a.cli.execute(line)).join('\n')), Buffer.from(input.flatMap(line => b.cli.execute(line)).join('\n')));
  assert.equal(a.files.read('out.svg'), b.files.read('out.svg'));
});
