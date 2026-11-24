import * as vscode from 'vscode';

export class SvgFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<vscode.Uri | undefined>();
  private readonly watcher = vscode.workspace.createFileSystemWatcher('**/*');
  private readonly listeners: vscode.Disposable[];
  readonly onDidChangeFileDecorations = this.changes.event;

  constructor() {
    // 创建/删除目录也可能影响其子项，所以让 VSCode 重新查询装饰。
    this.listeners = [
      this.watcher.onDidCreate(() => this.changes.fire(undefined)),
      this.watcher.onDidDelete(() => this.changes.fire(undefined)),
    ];
  }

  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file' || !/\.svg$/i.test(uri.path)) return undefined;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (!(stat.type & vscode.FileType.File) || (stat.type & vscode.FileType.Directory)) return undefined;
      return { badge: '[]', tooltip: 'SVG 文件', propagate: false };
    } catch {
      // 已删除或无法访问的文件不显示标记。
      return undefined;
    }
  }

  dispose(): void {
    this.listeners.forEach(listener => listener.dispose());
    this.watcher.dispose();
    this.changes.dispose();
  }
}
