import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Group } from '../src/model/Group.js';
import { Rect } from '../src/model/Rect.js';
import { ProtectedGroup } from './support/ProtectedGroup.js';
import { History } from '../src/commands/History.js';
import { DeleteCommand } from '../src/commands/DeleteCommand.js';
import { AddToCommand } from '../src/commands/AddToCommand.js';
import { GroupCommand } from '../src/commands/GroupCommand.js';
import { UngroupCommand } from '../src/commands/UngroupCommand.js';
import { MoveCommand } from '../src/commands/MoveCommand.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { DefaultDispatcher } from '../src/host/DefaultDispatcher.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { AttributeRegistry } from '../src/extensions/AttributeRegistry.js';
import { TreeDecoratorRegistry } from '../src/extensions/TreeDecoratorRegistry.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';
import { SampleTreeDecorator } from './support/SampleTreeDecorator.js';

test('必要子部件拒绝删除、移出、重新分组，受保护容器拒绝解组', () => {
  const document = new SvgDocument(); document.insert(new Group('scene'));
  const protectedGroup = new ProtectedGroup('p'); protectedGroup.add(new Rect('p-part'));
  document.insert(protectedGroup, 'scene');
  const history = new History(); history.execute(new MoveCommand('p', 1, 1), document);
  for (const command of [new DeleteCommand('p-part'), new AddToCommand('scene', 'p-part'),
    new GroupCommand('new', ['p-part']), new UngroupCommand('p')]) {
    const before = document.clone();
    assert.throws(() => history.execute(command, document), /required child|protected container/);
    assert.deepEqual(document, before);
    assert.ok(document.find('p') instanceof ProtectedGroup);
  }
  history.execute(new DeleteCommand('p'), document);
  assert.throws(() => document.find('p-part'), /no such shape/);
  history.undo(document); assert.ok(document.find('p') instanceof ProtectedGroup);
  history.redo(document); assert.throws(() => document.find('p'), /no such shape/);
});

test('多来源分组预检后才修改，树标题可与编辑消息标识区分', () => {
  const document = new SvgDocument(); document.insert(new Rect('r'));
  const protectedGroup = new ProtectedGroup('p'); protectedGroup.add(new Rect('p-part')); document.insert(protectedGroup);
  const before = document.clone();
  assert.throws(() => document.group('new', ['r', 'p-part']), /required child/);
  assert.deepEqual(document, before);
  assert.equal(protectedGroup.label, 'protected#p'); assert.equal(protectedGroup.treeLabel, 'g#p');
});

function fixture() {
  const files = new MemoryFileStore(); const session = new EditorSession(new DefaultRepository(files));
  const decorators = new TreeDecoratorRegistry();
  const cli = new DefaultDispatcher(session, new DefaultShapes(), new AttributeRegistry(), decorators);
  return { files, session, decorators, cli };
}

test('新建无保存点，成功保存建立隔离快照，编辑与 undo 不改写保存点', () => {
  const { session, cli } = fixture(); cli.execute('init'); cli.execute('create rect r 1 2 3 4 red');
  assert.equal(Boolean(session.savedDocument), false);
  cli.execute('save a.svg');
  const snapshot = session.savedDocument!; snapshot.find('r').set('fill', 'blue');
  assert.equal(session.savedDocument!.find('r').attributes.fill, 'red');
  cli.execute('set r fill green');
  assert.equal(session.savedDocument!.find('r').attributes.fill, 'red');
  cli.execute('undo'); assert.deepEqual(session.document, session.savedDocument);
  cli.execute('redo'); assert.equal(session.document.find('r').attributes.fill, 'green');
});

test('失败读写保留保存点、文档及重做；成功 read 更新保存点，init 清除', () => {
  const { files, session, cli } = fixture();
  cli.execute('init'); cli.execute('create rect r 1 2 3 4 red'); cli.execute('save a.svg');
  cli.execute('set r fill green'); cli.execute('undo');
  const before = session.savedDocument;
  files.blockWrite('blocked.svg');
  assert.throws(() => session.save('blocked.svg'), /cannot write/);
  assert.throws(() => session.read('missing.svg'), /cannot read/);
  assert.deepEqual(session.savedDocument, before);
  cli.execute('redo'); assert.equal(session.document.find('r').attributes.fill, 'green');
  session.read('a.svg'); assert.deepEqual(session.document, session.savedDocument);
  assert.equal(session.document.find('r').attributes.fill, 'red');
  session.init(); assert.equal(session.savedDocument, undefined);
});

test('另存更新内容保存点，但不改变无参数 save 的读入路径', () => {
  const { session, cli } = fixture();
  cli.execute('init'); cli.execute('save a.svg'); cli.execute('read a.svg');
  cli.execute('create g g'); cli.execute('save b.svg');
  assert.equal(session.currentPath, 'a.svg');
  assert.equal(session.savedDocument!.find('g').id, 'g');
});

test('树标签同时收到当前图形和保存快照，不需要访问会话内部字段', () => {
  const { session, decorators, cli } = fixture(); const seen: string[] = [];
  const decorator = new SampleTreeDecorator('observer', '');
  decorator.decorate = context => {
    if (context.shape) seen.push(`${context.shape.attributes.fill}/${context.savedDocument?.find(context.shape.id).attributes.fill}`);
    return undefined;
  };
  decorators.register(decorator);
  cli.execute('init'); cli.execute('create rect r 1 2 3 4 red'); cli.execute('save a.svg'); cli.execute('set r fill green');
  cli.execute('tree'); assert.deepEqual(seen, ['green/red']);
  assert.equal(session.document.find('r').attributes.fill, 'green');
  cli.execute('undo'); cli.execute('tree'); assert.equal(seen.at(-1), 'red/red');
});
