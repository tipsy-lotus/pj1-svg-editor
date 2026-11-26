import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModifiedStar } from '../plugins/tree-star/src/ModifiedStar.js';
import { TreeStarPlugin } from '../plugins/tree-star/src/TreeStarPlugin.js';
import { BoxPlugin } from '../plugins/box/src/BoxPlugin.js';
import { DefaultShapes } from '../src/host/DefaultShapes.js';
import { DefaultDispatcher } from '../src/host/DefaultDispatcher.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { AttributeRegistry } from '../src/extensions/AttributeRegistry.js';
import { TreeDecoratorRegistry } from '../src/extensions/TreeDecoratorRegistry.js';
import { SvgDocument } from '../src/model/SvgDocument.js';
import { Rect } from '../src/model/Rect.js';
import { DefaultRepository } from './support/DefaultRepository.js';
import { MemoryFileStore } from './support/MemoryFileStore.js';

function fixture() {
  const files = new MemoryFileStore(); const session = new EditorSession(new DefaultRepository(files));
  const decorators = new TreeDecoratorRegistry(); const attributes = new AttributeRegistry(); const shapes = new DefaultShapes();
  const cli = new DefaultDispatcher(session, shapes, attributes, decorators);
  new TreeStarPlugin().activate({ registerDecorator: item => decorators.register(item) });
  return { files, session, cli, shapes, decorators, attributes };
}

test('空新文档根立即标记，新建节点也标记，保存后全部消失', () => {
  const { cli } = fixture(); cli.execute('init'); assert.deepEqual(cli.execute('tree'), ['svg (800x600) *']);
  cli.execute('create rect r 0 0 10 10'); assert.match(cli.execute('tree r')[0]!, / \*$/);
  cli.execute('save a.svg'); assert.ok(!cli.execute('tree')[0]!.includes('*'));
});

test('编辑、保存、再编辑、undo 回保存点、redo 的内容状态机', () => {
  const { cli } = fixture(); cli.execute('init'); cli.execute('create rect r 0 0 10 10 red'); cli.execute('save a.svg');
  cli.execute('set r fill green'); assert.match(cli.execute('tree r')[0]!, / \*$/);
  cli.execute('undo'); assert.ok(!cli.execute('tree')[0]!.includes('*'));
  cli.execute('redo'); assert.match(cli.execute('tree r')[0]!, / \*$/);
  cli.execute('save b.svg'); assert.ok(!cli.execute('tree')[0]!.includes('*'));
  cli.execute('set r fill red'); assert.match(cli.execute('tree r')[0]!, / \*$/);
});

test('子节点修改传播到祖先和根，不影响未变的兄弟', () => {
  const { cli } = fixture(); cli.execute('init'); cli.execute('create g g');
  cli.execute('create rect a 0 0 10 10 red in g'); cli.execute('create rect b 0 0 10 10 blue in g'); cli.execute('save a.svg');
  cli.execute('set a fill orange'); const lines = cli.execute('tree')[0]!.split('\n');
  assert.match(lines[0]!, / \*$/); assert.match(lines[1]!, /g#g.* \*$/);
  assert.match(lines[2]!, /rect#a.* \*$/); assert.ok(!lines[3]!.endsWith('*'));
});

test('删除、同级顺序和画布尺寸变化也参与比较', () => {
  const { cli } = fixture(); cli.execute('init'); cli.execute('create g a'); cli.execute('create g b'); cli.execute('save a.svg');
  cli.execute('front a'); assert.match(cli.execute('tree a')[0]!, / \*$/); cli.execute('undo');
  cli.execute('delete b'); assert.match(cli.execute('tree')[0]!, /^svg .* \*/); cli.execute('undo');
  assert.ok(!cli.execute('tree')[0]!.includes('*'));
  cli.execute('canvas 100 100'); assert.match(cli.execute('tree')[0]!, /^svg .* \*/);
});

test('属性插入顺序不影响内容判断，状态封装在实例且不改写文档', () => {
  const current = new SvgDocument(); const saved = new SvgDocument(); const a = new Rect('r'); const b = new Rect('r');
  a.set('fill', 'red'); a.set('stroke', 'black'); b.set('stroke', 'black'); b.set('fill', 'red'); current.insert(a); saved.insert(b);
  const first = new ModifiedStar(); const second = new ModifiedStar(); const before = current.clone();
  assert.equal(first.decorate({ document: current, shape: a, savedDocument: saved }), undefined);
  assert.equal(second.decorate({ document: current, shape: a }), '*');
  assert.equal(first.decorate({ document: current, shape: a, savedDocument: saved }), undefined);
  assert.deepEqual(current, before);
});

test('失败保存不清除星号；成功读回清除；init 重新标记', () => {
  const { cli, files } = fixture(); cli.execute('init'); cli.execute('create g g'); cli.execute('save a.svg'); cli.execute('create g extra');
  files.blockWrite('bad.svg'); assert.match(cli.execute('save bad.svg')[0]!, /^error:/);
  assert.match(cli.execute('tree')[0]!, /^svg .* \*/);
  cli.execute('read a.svg'); assert.ok(!cli.execute('tree')[0]!.includes('*'));
  cli.execute('init'); assert.deepEqual(cli.execute('tree'), ['svg (800x600) *']);
});

test('与 box 标签并存且顺序稳定；保存后仅保留 box 标签', () => {
  const { cli, shapes, decorators, attributes } = fixture();
  new BoxPlugin().activate({ registerShape: item => shapes.register(item), registerAttribute: item => attributes.register(item), registerDecorator: item => decorators.register(item) });
  cli.execute('init'); cli.execute('create box n 0 0 100 50 title');
  // 本例先注册 star 再注册 box，顺序由装配决定，二者不互相调用。
  assert.match(cli.execute('tree n')[0]!.split('\n')[0]!, / \* \(box\)$/);
  cli.execute('save a.svg'); assert.match(cli.execute('tree n')[0]!.split('\n')[0]!, / \(box\)$/);
  assert.ok(!cli.execute('tree')[0]!.includes('*'));
});
