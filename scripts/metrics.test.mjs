import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SourceMetrics } from './SourceMetrics.mjs';

test('分支归属到各实现函数，嵌套函数不重复计入外层', () => {
  const result = new SourceMetrics().analyze('sample.ts', 'function outer(x) { if (x && x.a) return () => x ? 1 : 2; return 0; }');
  assert.equal(result.functions, 2);
  assert.deepEqual(result.units.map(unit => unit.complexity), [3, 2]);
  assert.equal(result.complexity, 5);
});
test('注释、字符串、正则和类型中的问号不构成分支', () => {
  const result = new SourceMetrics().analyze('sample.ts', 'interface A { x?: string; } type T<X> = X extends A ? 1 : 2; function f() { /* if && */ return /if|while/.test("if ? &&"); }');
  assert.equal(result.complexity, 1);
  assert.equal(result.functions, 1);
});
test('顶层分支单独计数，接口签名不计函数 CC', () => {
  const result = new SourceMetrics().analyze('sample.ts', 'interface A { f(): void; }\nif (ready) run();\n');
  assert.equal(result.functions, 0);
  assert.equal(result.complexity, 2);
  assert.equal(result.lines, 2);
});
test('循环、catch、非 default case 和逻辑表达式符合声明口径', () => {
  const result = new SourceMetrics().analyze('sample.ts', 'function f(xs) { try { for (const x of xs) { switch(x) { case 1: break; default: break; } } } catch (e) { return e ?? false; } }');
  assert.equal(result.complexity, 5);
});
