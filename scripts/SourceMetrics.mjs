import ts from 'typescript-analysis';

/** 分析真实 TypeScript AST，嵌套函数独立计数。 */
export class SourceMetrics {
  analyze(path, source) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    if (file.parseDiagnostics.length) throw new Error(`Cannot parse ${path}`);
    const units = [];
    let top = 0;
    const visit = (node, unit) => {
      if (ts.isTypeNode(node)) return;
      if (ts.isFunctionLike(node) && node.body) {
        unit = { line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, complexity: 1 };
        units.push(unit);
      }
      const decision = ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node)
        || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)
        || ts.isCatchClause(node) || ts.isCaseClause(node) || ts.isConditionalExpression(node)
        || (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken,
          ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(node.operatorToken.kind));
      if (decision) { if (unit) unit.complexity++; else top++; }
      ts.forEachChild(node, child => visit(child, unit));
    };
    visit(file, undefined);
    if (top) units.push({ line: 1, complexity: top + 1, topLevel: true });
    const imports = [];
    for (const statement of file.statements) {
      if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier) imports.push(statement.moduleSpecifier.text);
    }
    return { lines: source ? source.split(/\r\n|\n|\r/).length - (/\r\n$|[\n\r]$/.test(source) ? 1 : 0) : 0,
      functions: units.filter(unit => !unit.topLevel).length,
      complexity: units.reduce((sum, unit) => sum + unit.complexity, 0), units, imports };
  }
}
