import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Diamond } from '../plugins/diamond/src/Diamond.js';
import { DiamondProvider } from '../plugins/diamond/src/DiamondProvider.js';
import { DiamondPlugin } from '../plugins/diamond/src/DiamondPlugin.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { DefaultDispatcher } from '../src/host/DefaultDispatcher.js';
import { PluginHost } from '../src/host/PluginHost.js';
import { PluginLoader } from '../src/host/PluginLoader.js';
import { BuiltinCommandsPlugin } from '../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { SvgCodec } from '../src/io/SvgCodec.js';
import { SvgFileRepository } from '../src/io/SvgFileRepository.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { StatsCommand } from '../plugins/stats/src/StatsCommand.js';

function fixture(enable = true) {
  const shapes = new DefaultShapes(); if (enable) new DiamondPlugin().activate({ registerShape: item => shapes.register(item) });
  const files = new MemoryFileStore(); const codec = new SvgCodec(shapes);
  const session = new EditorSession(new SvgFileRepository(files, codec)); const cli = new DefaultDispatcher(session, shapes);
  return { shapes, files, codec, session, cli };
}

test('独立提供器创建四个菱形顶点、可选颜色与领域名称', () => {
  const shape = new DiamondProvider().create('d', ['100', '100', '80', '40', 'orange']);
  assert.ok(shape instanceof Diamond); assert.equal(shape.tag, 'polygon'); assert.equal(shape.label, 'diamond#d');
  assert.equal(shape.attributes.points, '100 80 140 100 100 120 60 100'); assert.equal(shape.attributes.fill, 'orange');
  assert.throws(() => new DiamondProvider().create('d', []), /usage/);
  assert.throws(() => new Diamond('d', 0, 0, 0, 10), /positive/);
});

test('整体移动缩放与几何 set 重新生成顶点，溢出失败不产生部分修改', () => {
  const shape = new Diamond('d', 100, 100, 80, 40);
  shape.move(10, 20); shape.scale(2);
  assert.equal(shape.attributes.points, '220 200 300 240 220 280 140 240');
  shape.set('width', '40'); assert.equal(shape.attributes['data-width'], '40');
  const before = shape.attributes; assert.throws(() => shape.scale(Number.MAX_VALUE), /invalid number/); assert.deepEqual(shape.attributes, before);
  assert.throws(() => shape.set('height', '-1'), /positive/); assert.deepEqual(shape.attributes, before);
});

test('样式与额外属性保留，普通白名单仍拒绝未知属性，clone 保留类型', () => {
  const shape = new Diamond('d', 1, 2, 3, 4); shape.set('stroke', 'black'); shape.importAttributes({ opacity: '0.5' });
  assert.throws(() => shape.set('points', '0 0'), /unknown attribute/);
  assert.throws(() => shape.set('label', 'no'), /unknown attribute/);
  const copy = shape.clone(); assert.ok(copy instanceof Diamond); assert.deepEqual(copy.attributes, shape.attributes);
  copy.set('fill', 'red'); assert.equal(shape.attributes.fill, undefined);
});

test('分组、属性、删除和撤销重做均复用已有命令与历史', () => {
  const { cli, session } = fixture(); cli.execute('init'); cli.execute('create diamond d 100 100 80 40 red');
  cli.execute('group g d'); cli.execute('move g 5 0');
  assert.equal(session.document.find('d').attributes['data-cx'], '105');
  cli.execute('undo'); assert.ok(session.document.find('d') instanceof Diamond);
  cli.execute('set d fill blue'); cli.execute('undo'); assert.equal(session.document.find('d').attributes.fill, 'red');
  cli.execute('redo'); assert.equal(session.document.find('d').attributes.fill, 'blue');
  cli.execute('delete g'); assert.equal(session.document.all().length, 0); cli.execute('undo');
  assert.ok(session.document.find('d') instanceof Diamond);
});

test('保存为标准 polygon 并精确读回；未装插件不静默丢弃', () => {
  const { cli, files, codec } = fixture(); cli.execute('init'); cli.execute('create diamond d 0.1 0.2 0.3 0.4 red'); cli.execute('save d.svg');
  assert.match(files.read('d.svg'), /<polygon/);
  const result = codec.decode(files.read('d.svg')).document; assert.ok(result.find('d') instanceof Diamond);
  assert.equal(codec.encode(result), files.read('d.svg'));
  assert.throws(() => fixture(false).codec.decode(files.read('d.svg')), /unknown shape type: polygon/);
});

test('缺失元数据、顶点不一致、普通 polygon 与非叶子拒绝读入并保持原历史', () => {
  const { cli, files, session } = fixture(); cli.execute('init'); cli.execute('create g old'); cli.execute('create g future'); cli.execute('undo');
  const valid = new Diamond('d', 100, 100, 80, 40).attributes;
  for (const attrs of [{ points: valid.points }, { ...valid, 'data-width': '' }, { ...valid, points: '0 0' }, { ...valid, cx: '5' }]) {
    files.put('bad.svg', `<svg><polygon id="d" ${Object.entries(attrs).map(([name, value]) => `${name}="${value}"`).join(' ')}/></svg>`);
    const before = session.document.clone(); assert.throws(() => session.read('bad.svg'), /invalid diamond structure|unknown shape type/); assert.deepEqual(session.document, before);
  }
  files.put('bad.svg', `<svg><polygon id="d" ${Object.entries(valid).map(([name, value]) => `${name}="${value}"`).join(' ')}><rect id="child"/></polygon></svg>`);
  const before = session.document.clone(); assert.throws(() => session.read('bad.svg'), /invalid diamond structure/); assert.deepEqual(session.document, before);
  cli.execute('redo'); assert.equal(session.document.find('future').id, 'future');
});

test('stats 无需修改，按标准 SVG polygon 计数', () => {
  const { cli, session } = fixture(); cli.execute('init'); cli.execute('create diamond d 100 100 80 40');
  assert.equal(new StatsCommand(session).run(), 'polygon: 1  (total 1, containers 0)');
});

test('代码和配置装配共用同一插件实现，输出和保存字节一致', async () => {
  const a = fixture(false), b = fixture(false);
  const hosts = [new PluginHost(a.session, a.shapes), new PluginHost(b.session, b.shapes)];
  for (const host of hosts) assert.deepEqual(await host.activate(new BuiltinCommandsPlugin(), JSON.parse(readFileSync('plugins/builtin-commands/package.json', 'utf8'))), []);
  assert.deepEqual(await hosts[0]!.activate(new DiamondPlugin(), JSON.parse(readFileSync('plugins/diamond/package.json', 'utf8'))), []);
  mkdirSync('.cache', { recursive: true }); const root = mkdtempSync(resolve('.cache/diamond-config-')); const path = join(root, 'plugins.json');
  writeFileSync(path, JSON.stringify({ plugins: [{ module: resolve('plugins/diamond') }] }));
  assert.deepEqual(await new PluginLoader(hosts[1]!).load(path), []);
  const input = ['init', 'create diamond d 100 100 80 40 orange', 'move d 5 10', 'scale d 2', 'set d width 40', 'undo', 'redo', 'tree', 'save d.svg', 'read d.svg', 'tree'];
  const outputs = hosts.map(host => Buffer.from(input.flatMap(line => host.dispatcher.execute(line)).join('\n')));
  assert.deepEqual(outputs[0], outputs[1]); assert.equal(a.files.read('d.svg'), b.files.read('d.svg'));
});
