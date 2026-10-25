import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable, Writable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { Repl } from '../src/cli/Repl.js';
import { Tokenizer } from '../src/cli/Tokenizer.js';
import { SvgCodec } from '../src/io/SvgCodec.js';
import { SvgFileRepository } from '../src/io/SvgFileRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';

test('分词支持整行注释、空行、BOM、引号空参数和颜色中的井号', () => {
  const tokenizer = new Tokenizer();
  for (const line of ['', '  ', '# comment', '  # comment', '\uFEFF# comment']) assert.deepEqual(tokenizer.parse(line), []);
  const tokens = tokenizer.parse('create text t 1 2 ""');
  assert.equal(tokens.at(-1)!.value, ''); assert.equal(tokens.at(-1)!.quoted, true);
  assert.deepEqual(tokenizer.parse('set r fill #abc').map(token => token.value), ['set', 'r', 'fill', '#abc']);
  assert.equal(tokenizer.parse('create text t 1 2 "a # b"').at(-1)!.value, 'a # b');
});

test('分词保留 Windows 路径反斜杠并支持文字中的转义双引号', () => {
  const tokenizer = new Tokenizer();
  const path = String.raw`C:\项目 文件\图.svg`;
  assert.equal(tokenizer.parse(`save "${path}"`)[1]!.value, path);
  const quoted = tokenizer.parse(String.raw`set t text "say \"hello\""`);
  assert.equal(quoted[3]!.value, 'say "hello"');
  for (const line of ['set t text "unfinished', 'set t text a"b"', 'set t text "a"b']) {
    assert.throws(() => tokenizer.parse(line));
  }
});

test('help 不需要文档，包含全部必需命令和六种图形参数', () => {
  const cli = new CommandDispatcher(new EditorSession(new SvgFileRepository(new MemoryFileStore())));
  const help = cli.execute('help').join('\n');
  for (const command of ['init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set', 'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'undo', 'redo']) {
    assert.ok(help.split('\n').some(line => line === command || line.startsWith(command + ' ')), command);
  }
  for (const shape of ['rect', 'circle', 'ellipse', 'line', 'text', 'g']) assert.ok(help.includes(`  ${shape} <id>`));
  assert.equal(cli.hadErrors, false);
});

test('有效命令在无文档时给出统一错误，未知命令也不会创建文档', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  for (const line of ['tree', 'show r', 'canvas', 'save a.svg', 'create g g', 'undo', 'redo']) {
    assert.deepEqual(cli.execute(line), ["error: no document. use 'init' or 'read' first"]);
  }
  assert.deepEqual(cli.execute('unknown'), ['error: unknown command: unknown']);
  assert.equal(cli.hadErrors, true);
});

test('init 可省略一个或两个尺寸，canvas 查询和修改语法明确', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  assert.deepEqual(cli.execute('init'), ['canvas 800x600 created']);
  assert.deepEqual(cli.execute('init 400'), ['canvas 400x600 created']);
  assert.deepEqual(cli.execute('canvas 200'), ['error: usage: canvas [w h]']);
  assert.deepEqual(cli.execute('canvas 200 100'), ['canvas resized to 200x100']);
  assert.deepEqual(cli.execute('canvas'), ['canvas 200x100']);
});

test('CLI 可创建六类图形并使用 in 子句形成嵌套结构', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  cli.execute('init');
  for (const line of [
    'create g scene', 'create g node in scene', 'create rect r 1 2 3 4 #abc in node',
    'create circle c 5 6 7 red in node', 'create ellipse e 1 2 3 4 in scene',
    'create line l 1 2 3 4 black in scene', 'create text t 1 2 "开始 节点" in node',
  ]) assert.ok(!cli.execute(line)[0]!.startsWith('error:'), line);
  assert.equal(session.document.all().length, 7);
  assert.equal(session.document.parentLabel(session.document.find('t')), 'g#node');
  assert.equal(session.document.find('r').attributes.fill, '#abc');
  assert.equal(session.document.find('t').text, '开始 节点');
});

test('带引号的 in 是普通文字，未被误识别为父容器子句', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  cli.execute('init'); cli.execute('create g scene');
  assert.deepEqual(cli.execute('create text t 1 2 "in" in scene'), ['text#t created in g#scene']);
  assert.equal(session.document.find('t').text, 'in');
  const before = session.document.clone();
  const output = cli.execute('create text wrong 1 2 "in" "scene"');
  assert.match(output[0]!, /^error: usage: create text/);
  assert.deepEqual(session.document, before);
});

test('结构树内联几何属性和文字，子树不包含兄弟，show 标明父级', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  cli.execute('init 400 300'); cli.execute('create g scene'); cli.execute('create rect r 1 2 30 40 red in scene');
  cli.execute('create text t 10 20 "My Diagram" in scene'); cli.execute('create circle outside 5 6 7');
  const tree = cli.execute('tree')[0]!;
  assert.match(tree, /^svg \(400x300\)/);
  assert.match(tree, /├── g#scene/); assert.match(tree, /│   ├── rect#r  x=1 y=2 width=30 height=40 fill=red/);
  assert.match(tree, /"My Diagram"/); assert.match(tree, /└── circle#outside/);
  const subtree = cli.execute('tree scene')[0]!;
  assert.match(subtree, /^g#scene/); assert.ok(!subtree.includes('outside'));
  assert.match(cli.execute('show r')[0]!, /^rect#r  parent=g#scene\n  x=1 y=2 width=30 height=40 fill=red$/);
  assert.match(cli.execute('show outside')[0]!, /parent=svg/);
});

test('tree、show、help 和 canvas 查询不占历史单元或清空重做', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  cli.execute('init'); cli.execute('create rect r 1 2 3 4'); cli.execute('move r 10 20'); cli.execute('undo');
  for (const line of ['tree', 'tree r', 'show r', 'help', 'canvas']) cli.execute(line);
  assert.deepEqual(cli.execute('redo'), ['redone: move r']);
  assert.equal(session.document.find('r').attributes.x, '11');
});

test('错误参数和引号解析失败不改变文档、路径或原有重做', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  cli.execute('init'); cli.execute('create rect r 1 2 3 4'); cli.execute('move r 10 20'); cli.execute('undo');
  const before = session.document.clone();
  for (const line of [
    'move r NaN 0', 'move r 1', 'scale r -1', 'create box b', 'set r r 1',
    'set r fill "unfinished', 'canvas 400', 'canvas 400 0', 'init 1 0',
    'undo extra', 'tree r extra', 'save a.svg extra', 'create g child in missing', 'create g child in r',
    'create rect bad 1 2 3 4 in', 'group g r r',
  ]) {
    const result = cli.execute(line);
    assert.equal(result.length, 1, line); assert.match(result[0]!, /^error: /, line);
    assert.equal(result[0]!.includes('\n'), false, line); assert.deepEqual(session.document, before, line);
    assert.equal(session.currentPath, undefined);
  }
  assert.deepEqual(cli.execute('redo'), ['redone: move r']);
});

test('CLI 读写支持带空格路径、导入警告、默认保存及保存后的历史屏障', () => {
  const files = new MemoryFileStore(); files.put('导入 文件.svg', '<svg width="400" height="300"><rect/></svg>');
  const session = new EditorSession(new SvgFileRepository(files)); const cli = new CommandDispatcher(session);
  assert.deepEqual(cli.execute('read "导入 文件.svg"'), [
    'warning: assigned id rect1 to unnamed <rect>', 'read 导入 文件.svg (1 elements)',
  ]);
  cli.execute('move rect1 10 20'); assert.deepEqual(cli.execute('save'), ['saved to 导入 文件.svg (1 elements)']);
  assert.equal(new SvgCodec().decode(files.read('导入 文件.svg')).document.find('rect1').attributes.x, '10');
  assert.deepEqual(cli.execute('undo'), ['error: undo not allowed after io command']);
  assert.deepEqual(cli.execute('save "另存 文件.svg"'), ['saved to 另存 文件.svg (1 elements)']);
  assert.equal(session.currentPath, '导入 文件.svg');
  cli.execute('move rect1 5 0');
  assert.deepEqual(cli.execute('save'), ['saved to 导入 文件.svg (1 elements)']);
  assert.equal(new SvgCodec().decode(files.read('导入 文件.svg')).document.find('rect1').attributes.x, '15');
  assert.equal(new SvgCodec().decode(files.read('另存 文件.svg')).document.find('rect1').attributes.x, '10');
});

test('失败读取只输出错误，不泄漏解析中已暂存的自动 ID 警告', () => {
  const files = new MemoryFileStore(); files.put('bad.svg', '<svg><rect/><circle r="-1"/></svg>');
  const session = new EditorSession(new SvgFileRepository(files)); const cli = new CommandDispatcher(session);
  cli.execute('init'); cli.execute('create g g');
  const before = session.document.clone(); const result = cli.execute('read bad.svg');
  assert.equal(result.length, 1); assert.match(result[0]!, /^error: /);
  assert.ok(!result[0]!.includes('warning:')); assert.deepEqual(session.document, before);
  assert.deepEqual(cli.execute('undo'), ['undone: create g#g']);
});

test('命令层结构操作经 CLI 分发后可一次撤销恢复', () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  cli.execute('init'); cli.execute('create g scene'); cli.execute('create rect a 1 2 3 4 in scene');
  cli.execute('create circle b 5 6 7 in scene');
  for (const line of ['group selected b a', 'addto scene b', 'front a', 'back b', 'delete scene', 'scale scene 2', 'set a fill red']) {
    const before = session.document.clone();
    assert.ok(!cli.execute(line)[0]!.startsWith('error:'), line);
    cli.execute('undo'); assert.deepEqual(session.document, before, line);
  }
  cli.execute('group selected a b');
  const grouped = session.document.clone(); cli.execute('ungroup selected');
  assert.deepEqual(session.document.find('scene').children.map(shape => shape.id), ['a', 'b']);
  cli.execute('undo'); assert.deepEqual(session.document, grouped);
});

test('错误输出将底层多行消息合并为单行，之后仍能继续编辑', () => {
  const files = new MemoryFileStore();
  const session = new EditorSession(new SvgFileRepository(files)); const cli = new CommandDispatcher(session);
  assert.deepEqual(cli.execute('read "a\nb.svg"'), ['error: cannot read file: a b.svg']);
  assert.deepEqual(cli.execute('init'), ['canvas 800x600 created']);
  assert.deepEqual(cli.execute('create g g'), ['g#g created']);
});

for (const command of ['quit', 'exit']) {
  test(`${command} 可在无文档时退出，错误参数不会提前退出`, () => {
    const cli = new CommandDispatcher(new EditorSession(new SvgFileRepository(new MemoryFileStore())));
    assert.match(cli.execute(command + ' extra')[0]!, /^error: usage:/); assert.equal(cli.stopped, false);
    assert.deepEqual(cli.execute(command), ['bye']); assert.equal(cli.stopped, true);
    assert.deepEqual(cli.execute('init'), []);
  });
}

test('REPL 处理 CRLF、错误后继续执行，EOF 正常结束且不输出批处理提示符', async () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Repl(cli).run(Readable.from(['# comment\r\ninit 400 300\r\nunknown\r\n', 'create g scene\r\ntree\r\n']), stream);
  assert.match(output, /svg-editor 0.1/); assert.match(output, /error: unknown command: unknown/);
  assert.match(output, /g#scene created/); assert.match(output, /svg \(400x300\)/);
  assert.ok(!output.includes('svg> ')); assert.equal(session.document.find('scene').id, 'scene');
});

test('REPL 遇到退出命令停止，不执行剩余输入', async () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Repl(cli).run(Readable.from(['init\nquit\ncreate g ignored\n']), stream);
  assert.equal(session.document.all().length, 0); assert.match(output, /bye\n$/);
  assert.ok(!output.includes('ignored'));
});

test('交互模式显示 svg 提示符，并能执行命令后退出', async () => {
  const session = new EditorSession(new SvgFileRepository(new MemoryFileStore())); const cli = new CommandDispatcher(session);
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Repl(cli).run(Readable.from(['init\nquit\n']), stream, true);
  assert.ok(output.includes('svg> ')); assert.match(output, /canvas 800x600 created/);
  assert.match(output, /bye/); assert.equal(cli.stopped, true);
});

test('完整回放两节点示例，保存读回后布局、文字及层级一致', async () => {
  const files = new MemoryFileStore(); const session = new EditorSession(new SvgFileRepository(files));
  const cli = new CommandDispatcher(session);
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Repl(cli).run(Readable.from([readFileSync('examples/flowchart.cli', 'utf8')]), stream);
  assert.equal(cli.hadErrors, false, output); assert.equal(cli.stopped, true);
  assert.equal(session.document.all().length, 8);
  assert.equal(session.document.find('process').attributes.y, '100');
  assert.equal(session.document.find('process-label').text, '处理数据 v2');
  assert.equal(session.document.parentLabel(session.document.find('process-label')), 'g#node2');
  assert.equal(new SvgCodec().decode(files.read('flowchart.svg')).document.find('edge').attributes.stroke, 'black');
  assert.match(output, /saved to flowchart.svg \(8 elements\)/); assert.match(output, /read flowchart.svg \(8 elements\)/);
});

test('完整回放基础会话示例，保存原文档后成功导入外部文件并补 ID', async () => {
  const files = new MemoryFileStore(); files.put('examples/import-example.svg', readFileSync('examples/import-example.svg', 'utf8'));
  const session = new EditorSession(new SvgFileRepository(files)); const cli = new CommandDispatcher(session);
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Repl(cli).run(Readable.from([readFileSync('examples/basic-session.cli', 'utf8')]), stream);
  assert.equal(cli.hadErrors, false, output);
  const original = new SvgCodec().decode(files.read('demo.svg')).document;
  assert.equal(original.find('title').text, 'My Diagram');
  assert.equal(original.find('c1').attributes.cx, '130');
  assert.equal(original.parentLabel(original.find('box')), 'g#markers');
  assert.equal(original.children[0]!.id, 'bg');
  assert.equal(session.document.all().length, 7);
  assert.match(output, /warning: assigned id rect1 to unnamed <rect>/);
});

test('CLI 新建文档另存后不产生读入路径，无参数保存报错且可继续撤销', () => {
  const files = new MemoryFileStore(); const session = new EditorSession(new SvgFileRepository(files));
  const cli = new CommandDispatcher(session);
  cli.execute('init'); cli.execute('create rect r 1 2 3 4'); cli.execute('save created.svg');
  cli.execute('move r 5 0');
  const before = session.document.clone();
  assert.deepEqual(cli.execute('save'), ["error: no read path. specify 'save <file.svg>'"]);
  assert.deepEqual(session.document, before);
  assert.equal(session.currentPath, undefined);
  assert.equal(new SvgCodec().decode(files.read('created.svg')).document.find('r').attributes.x, '1');
  assert.deepEqual(cli.execute('undo'), ['undone: move r']);
  assert.equal(session.document.find('r').attributes.x, '1');
});
