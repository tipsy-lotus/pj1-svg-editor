import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DirCommand } from '../plugins/dir/src/DirCommand.js';
import { DirPlugin } from '../plugins/dir/src/DirPlugin.js';
import { NodeDirectoryAccess } from '../plugins/dir/src/NodeDirectoryAccess.js';
import type { Command } from '../src/extensions/Command.js';
import { MemoryDirectoryAccess } from './support/MemoryDirectoryAccess.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultDispatcher } from './support/DefaultDispatcher.js';
import { PluginHost } from '../src/host/PluginHost.js';
import { PluginLoader } from '../src/host/PluginLoader.js';

test('混合项稳定排序，隐藏项保留，不递归或列出点目录', () => {
  const entries = [{ name: 'z.txt', kind: 'file' }, { name: 'b', kind: 'directory' },
    { name: '.hidden', kind: 'file' }, { name: 'a', kind: 'directory' }, { name: 'a.txt', kind: 'file' },
    { name: '.', kind: 'directory' }, { name: '..', kind: 'directory' }] as const;
  const access = new MemoryDirectoryAccess(entries); const command = new DirCommand(access);
  const expected = '[DIR]  a\n[DIR]  b\n[FILE]  .hidden\n[FILE]  a.txt\n[FILE]  z.txt';
  assert.equal(command.run(), expected); assert.equal(command.run(), expected);
  assert.deepEqual(access.entries, entries); assert.deepEqual(access.requested, ['/fixed', '/fixed']);
});

test('空目录与读取失败的约定输出；特殊项单独标注', () => {
  const empty = new MemoryDirectoryAccess([]); assert.equal(new DirCommand(empty).run(), '(empty directory)');
  empty.fail = true; assert.throws(() => new DirCommand(empty).run(), /^Error: cannot read directory: \/fixed$/);
  assert.equal(new DirCommand(new MemoryDirectoryAccess([{ name: 'l', kind: 'link' }, { name: 'o', kind: 'other' }])).run(), '[LINK]  l\n[OTHER]  o');
});

test('未初始化文档也能使用，help 与零参数规则由插件提供', () => {
  const session = new EditorSession(new DefaultRepository(new MemoryFileStore())); const cli = new DefaultDispatcher(session);
  assert.deepEqual(cli.execute('dir'), ['error: unknown command: dir']); assert.ok(!cli.execute('help').includes('dir'));
  new DirPlugin(new MemoryDirectoryAccess([])).activate({ registerCommand: command => cli.register(command) });
  assert.ok(cli.execute('help').includes('dir')); assert.deepEqual(cli.execute('dir'), ['(empty directory)']);
  assert.deepEqual(cli.execute('dir extra'), ['error: usage: dir']);
  assert.throws(() => session.document, /no document/);
});

test('dir 成功或失败均不改变文档、保存点、路径、cwd、历史屏障和 redo', () => {
  const files = new MemoryFileStore(); const session = new EditorSession(new DefaultRepository(files)); const cli = new DefaultDispatcher(session);
  const access = new MemoryDirectoryAccess([]); new DirPlugin(access).activate({ registerCommand: command => cli.register(command) });
  cli.execute('init'); cli.execute('create g g'); cli.execute('save original.svg'); cli.execute('read original.svg');
  cli.execute('dir'); assert.deepEqual(cli.execute('undo'), ['error: undo not allowed after io command']);
  cli.execute('create rect r 1 2 3 4'); cli.execute('undo');
  const before = session.document.clone(); const saved = session.savedDocument; const cwd = process.cwd();
  for (const failure of [false, true]) {
    access.fail = failure;
    assert.deepEqual(cli.execute('dir'), [failure ? 'error: cannot read directory: /fixed' : '(empty directory)']);
    assert.deepEqual(session.document, before); assert.deepEqual(session.savedDocument, saved);
    assert.equal(session.currentPath, 'original.svg'); assert.equal(process.cwd(), cwd);
  }
  cli.execute('redo'); assert.equal(session.document.find('r').tag, 'rect');
  assert.ok(access.requested.every(path => path === '/fixed'));
});

function realDirectory() {
  mkdirSync('.cache', { recursive: true }); const root = mkdtempSync(resolve('.cache/dir-test-'));
  const working = join(root, 'working'); mkdirSync(working);
  return { root, working };
}

test('真实文件系统适配器组合验证隐藏项、排序、空目录与读取失败', () => {
  const { working } = realDirectory(); const previous = process.cwd();
  try {
    process.chdir(working); const adapter = new NodeDirectoryAccess(); const command = new DirCommand(adapter);
    assert.equal(command.run(), '(empty directory)');
    mkdirSync('z-dir'); mkdirSync('a-dir'); writeFileSync('z.txt', ''); writeFileSync('.hidden', '');
    writeFileSync(join('z-dir', 'nested.txt'), '');
    assert.equal(command.run(), '[DIR]  a-dir\n[DIR]  z-dir\n[FILE]  .hidden\n[FILE]  z.txt');
    assert.throws(() => adapter.list(join(working, 'absent')));
  } finally { process.chdir(previous); }
});

test('代码与配置装配访问相同固定工作目录并输出相同字节，日志不写入该目录', async () => {
  const { root, working } = realDirectory(); const previous = process.cwd();
  mkdirSync(join(working, 'docs')); writeFileSync(join(working, 'a.svg'), '');
  const manifest = JSON.parse(readFileSync('plugins/dir/package.json', 'utf8'));
  const config = join(root, 'plugins.json');
  writeFileSync(config, JSON.stringify({ plugins: [{ module: resolve('plugins/dir') }] }));
  const a = new PluginHost(new EditorSession(new DefaultRepository(new MemoryFileStore())));
  const b = new PluginHost(new EditorSession(new DefaultRepository(new MemoryFileStore())));
  try {
    process.chdir(working);
    assert.deepEqual(await a.activate(new DirPlugin(), manifest), []);
    assert.deepEqual(await new PluginLoader(b).load(config), []);
    const outputA = a.dispatcher.execute('dir').join('\n'); const outputB = b.dispatcher.execute('dir').join('\n');
    assert.equal(outputA, '[DIR]  docs\n[FILE]  a.svg');
    assert.deepEqual(Buffer.from(outputA), Buffer.from(outputB));
    writeFileSync(join(root, 'code.log'), outputA); writeFileSync(join(root, 'config.log'), outputB);
    assert.equal(a.dispatcher.execute('dir').join('\n'), outputA);
  } finally { process.chdir(previous); }
});

test('插件通过目录访问测试替身独立注册类实例，不依赖其他插件', () => {
  const commands: Command[] = [];
  new DirPlugin(new MemoryDirectoryAccess([])).activate({ registerCommand: command => commands.push(command) });
  assert.ok(commands[0] instanceof DirCommand); assert.equal(commands[0]!.run(), '(empty directory)');
});
