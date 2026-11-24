const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// 仅替代 VSCode 宿主 API，真实 XML 解析器仍参与测试。
class EventEmitter {
  listeners = [];
  event = listener => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(item => item !== listener); } };
  };
  fire(value) { this.listeners.forEach(listener => listener(value)); }
  dispose() { this.listeners = []; }
}
class Range {
  constructor(start, end) { this.start = start; this.end = end; }
}
class DocumentSymbol {
  constructor(name, detail, kind, range, selectionRange) {
    Object.assign(this, { name, detail, kind, range, selectionRange, children: [] });
  }
}
const registrations = [];
const commands = new Map();
const notices = [];
let watcher;
const vscode = {
  EventEmitter, Range, DocumentSymbol,
  FileType: { File: 1, Directory: 2 },
  SymbolKind: { Namespace: 2, Object: 18 },
  workspace: {
    fs: { stat: async uri => { if (uri.missing) throw new Error('missing'); return { type: uri.type }; } },
    createFileSystemWatcher: () => {
      const create = new EventEmitter();
      const remove = new EventEmitter();
      watcher = { onDidCreate: create.event, onDidDelete: remove.event,
        create, remove, disposed: false, dispose() { this.disposed = true; } };
      return watcher;
    },
  },
  window: {
    registerFileDecorationProvider: provider => { registrations.push(provider); return { dispose() {} }; },
    showInformationMessage(message) { notices.push(message); },
    showWarningMessage(message) { notices.push(message); },
  },
  languages: {
    match: (selector, document) => document.uri.scheme === 'file' && /\.svg$/i.test(document.uri.path) ? 10 : 0,
    registerDocumentSymbolProvider: (selector, provider) => {
      registrations.push({ selector, provider }); return { dispose() {} };
    },
  },
  commands: { registerCommand: (name, callback) => { commands.set(name, callback); return { dispose() {} }; } },
};
const originalLoad = Module._load;
let SvgFileDecorationProvider, SvgDocumentSymbolProvider, activate;
try {
  Module._load = function (name, ...args) {
    return name === 'vscode' ? vscode : originalLoad.call(this, name, ...args);
  };
  ({ SvgFileDecorationProvider } = require('../dist/SvgFileDecorationProvider.js'));
  ({ SvgDocumentSymbolProvider } = require('../dist/SvgDocumentSymbolProvider.js'));
  ({ activate } = require('../dist/extension.js'));
} finally {
  Module._load = originalLoad;
}

test('仅 SVG 普通文件有标记；同名目录、非 SVG、已删除文件不标记', async () => {
  const provider = new SvgFileDecorationProvider();
  const file = { scheme: 'file', path: '/test/demo.svg', type: 1 };
  assert.deepEqual(await provider.provideFileDecoration(file), { badge: '[]', tooltip: 'SVG 文件', propagate: false });
  assert.ok(await provider.provideFileDecoration({ ...file, path: '/test/UPPER.SVG' }));
  for (const uri of [{ ...file, type: 2 }, { ...file, path: '/test/note.txt' },
    { ...file, missing: true }, { ...file, scheme: 'untitled' }]) {
    assert.equal(await provider.provideFileDecoration(uri), undefined);
  }
  assert.equal(file.path, '/test/demo.svg');
  const currentWatcher = watcher;
  let refreshes = 0;
  provider.onDidChangeFileDecorations(() => refreshes++);
  currentWatcher.create.fire(file);
  currentWatcher.remove.fire(file);
  assert.equal(refreshes, 2);
  provider.dispose();
  assert.equal(currentWatcher.disposed, true);
  currentWatcher.create.fire(file);
  assert.equal(refreshes, 2);
});

function document(source) {
  return { getText: () => source, positionAt: offset => {
    const lines = source.slice(0, offset).split('\n');
    return { line: lines.length - 1, character: lines.at(-1).length };
  } };
}

test('大纲 provider 返回嵌套符号和源码定位，并反映未保存内容', () => {
  const provider = new SvgDocumentSymbolProvider();
  const token = { isCancellationRequested: false };
  const first = '<svg>\n  <g id="flow">\n    <rect id="start"/>\n  </g>\n</svg>';
  const symbols = provider.provideDocumentSymbols(document(first), token);
  const rect = symbols[0].children[0].children[0];
  assert.equal(rect.name, 'rect#start');
  assert.deepEqual(rect.selectionRange.start, { line: 2, character: 5 });
  assert.deepEqual(rect.range.start, { line: 2, character: 4 });
  assert.equal(provider.provideDocumentSymbols(document(first.replace('start', 'edited')), token)[0].children[0].children[0].name, 'rect#edited');
  assert.deepEqual(provider.provideDocumentSymbols(document('<svg><g'), token), []);
  assert.deepEqual(provider.provideDocumentSymbols(document(first), { isCancellationRequested: true }), []);
});

test('激活时注册文件装饰和原生大纲，并交给宿主释放资源', () => {
  const context = { subscriptions: [] };
  activate(context);
  assert.ok(registrations.some(item => item instanceof SvgFileDecorationProvider));
  assert.ok(registrations.some(item => item.provider instanceof SvgDocumentSymbolProvider));
  context.subscriptions.forEach(item => item.dispose());
});

test('启动检查区分非文本页、错误文件和正常 SVG 文本', () => {
  const check = commands.get('pj1Svg.checkActivation');
  vscode.window.activeTextEditor = undefined;
  check();
  assert.match(notices.at(-1), /当前不是文本编辑器/);
  vscode.window.activeTextEditor = { document: {
    ...document('<svg><rect id="start"/></svg>'), uri: { scheme: 'file', path: '/outline.svg' },
  } };
  check();
  assert.match(notices.at(-1), /大纲匹配：是；根节点：1/);
  vscode.window.activeTextEditor.document.uri.path = '/note.txt';
  check();
  assert.match(notices.at(-1), /大纲匹配：否；根节点：0/);
});
