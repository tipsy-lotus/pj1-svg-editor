import * as vscode from 'vscode';
import type { OutlineElement } from './OutlineElement';
import { SvgOutlineParser } from './SvgOutlineParser';

export class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private readonly parser = new SvgOutlineParser();

  provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.DocumentSymbol[] {
    if (token.isCancellationRequested) return [];
    // 每次读取编辑器当前内容，包含尚未保存的修改；更新调度由 VSCode 负责。
    return this.parser.parse(document.getText()).map(element => this.toSymbol(document, element));
  }

  private toSymbol(document: vscode.TextDocument, element: OutlineElement): vscode.DocumentSymbol {
    const symbol = new vscode.DocumentSymbol(
      element.name, '', element.children.length ? vscode.SymbolKind.Namespace : vscode.SymbolKind.Object,
      new vscode.Range(document.positionAt(element.start), document.positionAt(element.end)),
      new vscode.Range(document.positionAt(element.selectionStart), document.positionAt(element.selectionEnd)),
    );
    symbol.children = element.children.map(child => this.toSymbol(document, child));
    return symbol;
  }
}
