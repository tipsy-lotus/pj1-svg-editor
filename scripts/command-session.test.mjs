import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { CommandPluginReplay } from './CommandPluginReplay.mjs';

test('固定目录中的真实文件读写与双装配会话匹配已提交输出', async () => {
  const result = await new CommandPluginReplay().run();
  assert.deepEqual(result.code, readFileSync(new URL('../doc/transcript/command-plugins.code.txt', import.meta.url)));
  assert.deepEqual(result.config, readFileSync(new URL('../doc/transcript/command-plugins.config.txt', import.meta.url)));
  assert.match(result.code.toString('utf8'), /rect: 1  circle: 1  \(total 2, containers 1\)/);
  assert.match(result.code.toString('utf8'), /text: 1  \(total 1, containers 0\)/);
  assert.equal(result.code.toString('utf8').split('[DIR]  docs').length - 1, 4);
});
