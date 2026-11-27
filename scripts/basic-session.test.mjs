import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { BasicReplay } from './BasicReplay.mjs';

test('基础与流程图会话双装配输出和保存文件逐字节一致', async () => {
  const results = await new BasicReplay().run();
  assert.equal(results.length, 2);
  for (const result of results) {
    assert.deepEqual(result.code, readFileSync(new URL(`../doc/transcript/${result.name}.code.txt`, import.meta.url)));
    assert.deepEqual(result.config, readFileSync(new URL(`../doc/transcript/${result.name}.config.txt`, import.meta.url)));
    assert.deepEqual(result.svg, readFileSync(new URL(`../doc/transcript/${result.name}.saved.svg`, import.meta.url)));
  }
});
