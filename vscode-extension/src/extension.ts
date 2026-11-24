import * as vscode from 'vscode';
import { SvgFileDecorationProvider } from './SvgFileDecorationProvider';
import { SvgDocumentSymbolProvider } from './SvgDocumentSymbolProvider';
import { SvgOutlineParser } from './SvgOutlineParser';

export function activate(context: vscode.ExtensionContext): void {
  const decorations = new SvgFileDecorationProvider();
  const symbols = new SvgDocumentSymbolProvider();
  const selector: vscode.DocumentSelector = [
    { scheme: 'file', pattern: '**/*.[sS][vV][gG]' },
    { scheme: 'untitled', pattern: '**/*.[sS][vV][gG]' },
  ];
  context.subscriptions.push(
    decorations,
    vscode.window.registerFileDecorationProvider(decorations),
    vscode.languages.registerDocumentSymbolProvider(
      selector, symbols,
    ),
    vscode.commands.registerCommand('pj1Svg.checkActivation', () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document) {
        void vscode.window.showWarningMessage('SVG 扩展已启动，但当前不是文本编辑器。请右键 outline.svg，选择“打开方式 → 文本编辑器”。');
        return;
      }
      const matched = vscode.languages.match(selector, document) > 0;
      const roots = matched ? new SvgOutlineParser().parse(document.getText()) : [];
      void vscode.window.showInformationMessage(
        `SVG 扩展已启动；当前文件：${document.uri.path}；大纲匹配：${matched ? '是' : '否'}；根节点：${roots.length}`,
      );
    }),
  );
}
