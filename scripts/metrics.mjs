import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, posix } from 'node:path';
import { SourceMetrics } from './SourceMetrics.mjs';

const [snapshot, baseCommit, targetCommit, baseRef, targetRef, output = 'docs/metrics'] = process.argv.slice(2);
if (!snapshot || !baseCommit || !targetCommit) throw new Error('Run scripts/metrics.ps1');
const analyzer = new SourceMetrics();
const responsibilities = {
  model: '图形、容器、文档与图形注册', commands: '可撤销编辑事务与历史',
  io: 'SVG 编解码与文件访问', application: '文档会话', cli: '分词、分派与结构展示',
  extensions: '公开扩展契约与注册表', host: '装配、激活事务与模块加载',
};
function collect(root, relative = '') {
  let items;
  try { items = readdirSync(join(root, relative), { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return items.flatMap(item => {
    const path = (relative ? relative + '/' : '') + item.name;
    if (['node_modules', 'dist', '.git', '.cache', 'coverage', 'test'].includes(item.name)) return [];
    if (item.isDirectory()) return collect(root, path);
    if (!item.isFile() || !path.endsWith('.ts')) return [];
    const category = path.startsWith('plugins/') ? 'plugins' : path.startsWith('vscode-extension/') ? 'vscode'
      : path === 'src/main.ts' || path.startsWith('src/host/') ? 'assembly' : path.startsWith('src/') ? 'kernel' : undefined;
    if (!category) return [];
    const part = path.split('/')[1];
    const responsibility = category === 'plugins' ? `插件包 ${part}` : category === 'vscode' ? 'VSCode 文件标记与大纲'
      : path === 'src/main.ts' ? 'CLI 启动组合根' : responsibilities[part] ?? '内核';
    return [{ path, category, responsibility, ...analyzer.analyze(path, readFileSync(join(root, path), 'utf8')) }];
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
const base = collect(join(snapshot, 'base')); const target = collect(join(snapshot, 'target'));
const violations = target.flatMap(row => row.imports.flatMap(request => {
  if (!request.startsWith('.')) return [];
  const destination = posix.normalize(posix.join(posix.dirname(row.path), request));
  if (row.category === 'kernel' && (destination.startsWith('plugins/') || destination.startsWith('src/host/'))
    || row.category === 'plugins' && destination.startsWith('src/host/')) return [`${row.path} -> ${request}`];
  return [];
}));
if (violations.length) throw new Error('Forbidden static dependencies: ' + violations.join(', '));
function totals(rows, category) {
  return rows.filter(row => row.category === category).reduce((sum, row) => ({ files: sum.files + 1,
    lines: sum.lines + row.lines, complexity: sum.complexity + row.complexity }), { files: 0, lines: 0, complexity: 0 });
}
const report = { baseRef, targetRef, baseCommit, targetCommit, forbiddenStaticDependencies: violations, base, target };
mkdirSync(resolve(output), { recursive: true });
writeFileSync(join(output, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
const lines = ['# CLI 重构指标（脚本生成）', '', `基线：${baseRef} (${baseCommit})`, `目标：${targetRef} (${targetCommit})`, '',
  '当前是阶段快照；收尾必须用 final 与 p2 再生成。统计来自已提交的 Git 快照，不包含工作区未提交内容。', '',
  '| 分类 | 基线文件 / 行数 / CC | 目标文件 / 行数 / CC | 行数增量 | CC 增量 |', '| --- | --- | --- | --- | --- |'];
for (const category of ['kernel', 'assembly', 'plugins', 'vscode']) {
  const a = totals(base, category), b = totals(target, category);
  lines.push(`| ${category} | ${a.files} / ${a.lines} / ${a.complexity} | ${b.files} / ${b.lines} / ${b.complexity} | ${b.lines - a.lines} | ${b.complexity - a.complexity} |`);
}
const cliTotal = rows => ['kernel', 'assembly', 'plugins'].map(category => totals(rows, category))
  .reduce((sum, item) => ({ files: sum.files + item.files, lines: sum.lines + item.lines, complexity: sum.complexity + item.complexity }), { files: 0, lines: 0, complexity: 0 });
const a = cliTotal(base), b = cliTotal(target);
lines.push(`| CLI 合计（不含 VSCode） | ${a.files} / ${a.lines} / ${a.complexity} | ${b.files} / ${b.lines} / ${b.complexity} | ${b.lines - a.lines} | ${b.complexity - a.complexity} |`);
lines.push('', 'kernel=内核，assembly=装配处，plugins=CLI 插件；vscode 单独列出，不计入 CLI 重构增量。', '',
  '口径：物理行数包含空行、注释和声明。CC 为实现函数的 1 + 分支数之和，嵌套函数单独计算；存在顶层分支时将顶层作为独立单元加入。分支包括 if、循环、catch、非 default case、三元表达式、&&、||、?? 及对应逻辑赋值。类型节点跳过；可选链、默认参数、default、普通 try 和 finally 不增加 CC。接口签名无函数体，不计函数 CC。', '',
  'AST 解析器固定为 typescript-analysis（TypeScript 6.0.3），与项目 TypeScript 7 编译器分开；这是明确口径下的静态指标，不代表测试覆盖率或代码质量评分。', '',
  '范围：src、plugins 与单列的 vscode-extension 中的 TypeScript；排除测试、依赖、构建产物及缓存。插件中业务逻辑迁移会使内核减少、插件增加，应结合总量及逐文件明细解读。', '',
  '## 目标文件清单与职责', '', '| 文件 | 分类 | 模块职责 | 行数 | CC |', '| --- | --- | --- | --- | --- |');
for (const row of target) lines.push(`| ${row.path} | ${row.category} | ${row.responsibility} | ${row.lines} | ${row.complexity} |`);
lines.push('', '逐函数行号、复杂度、基线文件明细和静态导入列表见 metrics.json。', '',
  '静态依赖检查：内核不得导入 plugins 或 src/host，插件不得导入 src/host；当前快照无违反项。这里只检查 AST 静态 import/export，动态加载器仍需人工核对，不能据此宣称全部依赖契约已经验收。', '');
writeFileSync(join(output, 'README.md'), lines.join('\n'));
console.log(`Generated ${output}: ${baseRef} -> ${targetRef}`);
