import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { BoxReplay } from './BoxReplay.mjs';

test('题目 §6.1 box 完整会话匹配双装配输出及保存图形', async () => {
  const result = await new BoxReplay().run();
  assert.deepEqual(result.code, readFileSync(new URL('../doc/transcript/box.code.txt', import.meta.url)));
  assert.deepEqual(result.config, readFileSync(new URL('../doc/transcript/box.config.txt', import.meta.url)));
  assert.deepEqual(result.svg, readFileSync(new URL('../doc/transcript/box.saved.svg', import.meta.url)));
});
