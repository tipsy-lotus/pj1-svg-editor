import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PluginLoader } from '../src/host/PluginLoader.js';
import { PluginHost } from '../src/host/PluginHost.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { BuiltinShapesPlugin } from '../plugins/builtin-shapes/src/BuiltinShapesPlugin.js';
import { BuiltinCommandsPlugin } from '../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { readFileSync } from 'node:fs';

function fixture() {
  mkdirSync('.cache', { recursive: true });
  const root = mkdtempSync(resolve('.cache/loader-test-'));
  const host = new PluginHost(new EditorSession(new DefaultRepository(new MemoryFileStore())));
  const config = join(root, 'plugins.config.json');
  return { root, host, config, loader: new PluginLoader(host) };
}
function plugin(root: string, name: string, source: string, commands: string[] = []) {
  const directory = join(root, name); mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, type: 'module', main: 'index.js', contributes: { commands } }));
  writeFileSync(join(directory, 'index.js'), source);
}
const echo = `class Echo { name='echo'; syntax='echo'; minimum=0; maximum=0; constructor(value) { this.value=value; } run() { return this.value; } }
export default new class { activate(ctx, options) { ctx.registerCommand(new Echo(options?.value ?? 'ok')); } }();`;

test('相对模块路径以配置目录为基准，传入 options；禁用项不解析', async () => {
  const f = fixture(); plugin(f.root, 'good', echo, ['echo']);
  writeFileSync(f.config, JSON.stringify({ plugins: [{ module: './missing', enabled: false }, { module: './good', options: { value: 'configured' } }] }));
  assert.deepEqual(await f.loader.load(f.config), []);
  assert.deepEqual(f.host.dispatcher.execute('echo'), ['configured']);
});

test('找不到模块、无默认导出、清单不符与激活失败均有诊断并继续', async () => {
  const f = fixture();
  plugin(f.root, 'no-default', 'export const value = 1;');
  plugin(f.root, 'mismatch', echo);
  plugin(f.root, 'throws', 'export default new class { activate() { throw new Error("broken"); } }();');
  plugin(f.root, 'good', echo, ['echo']);
  writeFileSync(f.config, JSON.stringify({ plugins: ['missing', './no-default', './mismatch', './throws', './good'].map(module => ({ module })) }));
  const errors = await f.loader.load(f.config);
  assert.equal(errors.length, 4);
  assert.equal(errors[0], 'error: plugin not found: missing');
  assert.equal(errors[1], 'error: plugin has no default export: ./no-default');
  assert.match(errors[2]!, /^error: plugin manifest mismatch: mismatch/);
  assert.equal(errors[3], 'error: plugin failed to activate: throws (broken)');
  assert.deepEqual(f.host.dispatcher.execute('echo'), ['ok']);
});

test('模块已找到但依赖缺失、求值异常或入口损坏，不误报顶层插件不存在', async () => {
  const f = fixture();
  plugin(f.root, 'dependency', 'import "./absent.js"; export default {};');
  plugin(f.root, 'evaluation', 'throw new Error("evaluation failed");');
  mkdirSync(join(f.root, 'bad-entry'));
  writeFileSync(join(f.root, 'bad-entry/package.json'), JSON.stringify({ name: 'bad-entry', main: 'absent.js' }));
  writeFileSync(f.config, JSON.stringify({ plugins: [{ module: './dependency' }, { module: './evaluation' }, { module: './bad-entry' }] }));
  const errors = await f.loader.load(f.config);
  assert.match(errors[0]!, /^error: plugin failed to activate: dependency/);
  assert.match(errors[1]!, /^error: plugin failed to activate: evaluation/);
  assert.match(errors[2]!, /^error: plugin failed to activate:/);
  assert.ok(errors.every(error => !error.includes('plugin not found:')));
});

test('配置整体预检，后面的结构错误也不会激活前面的合法项', async () => {
  const f = fixture(); plugin(f.root, 'good', echo, ['echo']);
  for (const contents of ['{', '{}', '{"plugins":{}}', '{"plugins":[null]}',
    JSON.stringify({ plugins: [{ module: './good' }, { module: './bad', enabled: 'false' }] })]) {
    writeFileSync(f.config, contents);
    assert.deepEqual(await f.loader.load(f.config), ['error: invalid plugin config']);
    assert.equal(f.host.dispatcher.context.commands().length, 0);
  }
  assert.deepEqual(await f.loader.load(join(f.root, 'missing.json')), ['error: invalid plugin config']);
});

test('配置重复注册整包回滚，保留先加载的插件且仍能加载后续项', async () => {
  const f = fixture(); plugin(f.root, 'first', echo, ['echo']); plugin(f.root, 'duplicate', echo, ['echo']);
  plugin(f.root, 'next', 'export default new class { activate(ctx) { ctx.registerCommand(new class { name="next"; syntax="next"; minimum=0; maximum=0; run() { return "ready"; } }()); } }();', ['next']);
  writeFileSync(f.config, JSON.stringify({ plugins: ['./first', './duplicate', './next'].map(module => ({ module })) }));
  assert.deepEqual(await f.loader.load(f.config), ['error: duplicate registration: commands/echo']);
  assert.deepEqual(f.host.dispatcher.execute('echo'), ['ok']); assert.deepEqual(f.host.dispatcher.execute('next'), ['ready']);
});

test('支持通过配置目录的 node_modules 解析包名', async () => {
  const f = fixture(); plugin(join(f.root, 'node_modules'), '@fixture/echo', echo, ['echo']);
  writeFileSync(f.config, JSON.stringify({ plugins: [{ module: '@fixture/echo' }] }));
  assert.deepEqual(await f.loader.load(f.config), []);
  assert.deepEqual(f.host.dispatcher.execute('echo'), ['ok']);
});

test('配置失败后内置命令和六种图形仍可用', async () => {
  const f = fixture();
  for (const [implementation, name] of [[new BuiltinShapesPlugin(), 'builtin-shapes'], [new BuiltinCommandsPlugin(), 'builtin-commands']] as const) {
    await f.host.activate(implementation, JSON.parse(readFileSync(`plugins/${name}/package.json`, 'utf8')));
  }
  writeFileSync(f.config, '{');
  assert.deepEqual(await f.loader.load(f.config), ['error: invalid plugin config']);
  assert.deepEqual(f.host.dispatcher.execute('init'), ['canvas 800x600 created']);
  assert.deepEqual(f.host.dispatcher.execute('create g g'), ['g#g created']);
});

test('同一个插件实例经代码与配置两种装配后输出逐字节一致', async () => {
  const a = fixture(); const b = fixture(); plugin(a.root, 'good', echo, ['echo']);
  const options = { value: 'same options' };
  const implementation = await import(pathToFileURL(join(a.root, 'good/index.js')).href);
  const manifest = JSON.parse(readFileSync(join(a.root, 'good/package.json'), 'utf8'));
  assert.deepEqual(await a.host.activate(implementation.default, manifest, options), []);
  writeFileSync(b.config, JSON.stringify({ plugins: [{ module: join(a.root, 'good'), options }] }));
  assert.deepEqual(await b.loader.load(b.config), []);
  const input = ['echo', 'echo extra', 'echo'];
  const outputA = Buffer.from(input.flatMap(line => a.host.dispatcher.execute(line)).join('\n'), 'utf8');
  const outputB = Buffer.from(input.flatMap(line => b.host.dispatcher.execute(line)).join('\n'), 'utf8');
  assert.deepEqual(outputA, outputB);
});
