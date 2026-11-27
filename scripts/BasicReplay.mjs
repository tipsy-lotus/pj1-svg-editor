import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShapeFactory } from '../dist/src/model/ShapeFactory.js';
import { EditorSession } from '../dist/src/application/EditorSession.js';
import { SvgCodec } from '../dist/src/io/SvgCodec.js';
import { SvgFileRepository } from '../dist/src/io/SvgFileRepository.js';
import { NodeFileStore } from '../dist/src/io/NodeFileStore.js';
import { PluginHost } from '../dist/src/host/PluginHost.js';
import { PluginLoader } from '../dist/src/host/PluginLoader.js';
import { Repl } from '../dist/src/cli/Repl.js';
import { BuiltinShapesPlugin } from '../dist/plugins/builtin-shapes/src/BuiltinShapesPlugin.js';
import { BuiltinCommandsPlugin } from '../dist/plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { StatsPlugin } from '../dist/plugins/stats/src/StatsPlugin.js';
import { DirPlugin } from '../dist/plugins/dir/src/DirPlugin.js';
import { BoxPlugin } from '../dist/plugins/box/src/BoxPlugin.js';
import { TreeStarPlugin } from '../dist/plugins/tree-star/src/TreeStarPlugin.js';
import { DiamondPlugin } from '../dist/plugins/diamond/src/DiamondPlugin.js';

export class BasicReplay {
  async run() {
    const repository = fileURLToPath(new URL('../', import.meta.url));
    mkdirSync(join(repository, '.cache'), { recursive: true });
    const root = mkdtempSync(join(repository, '.cache/basic-replay-'));
    const previous = process.cwd(); const results = [];
    try {
      for (const [name, inputFile, savedFile] of [['cli-1', 'basic-session.cli', 'demo.svg'], ['cli-1-flowchart', 'flowchart.cli', 'flowchart.svg']]) {
        const input = readFileSync(join(repository, `doc/transcript/${name}.txt`), 'utf8');
        assert.equal(input, 'help\n' + readFileSync(join(repository, `examples/${inputFile}`), 'utf8').replace(/\r\n/g, '\n'));
        const working = join(root, name); mkdirSync(working); mkdirSync(join(working, 'examples'));
        copyFileSync(join(repository, 'examples/import-example.svg'), join(working, 'examples/import-example.svg'));
        const output = []; const saved = [];
        process.chdir(working);
        for (const mode of ['code', 'config']) {
          const shapes = new ShapeFactory();
          const session = new EditorSession(new SvgFileRepository(new NodeFileStore(), new SvgCodec(shapes)));
          const host = new PluginHost(session, shapes);
          for (const [plugin, packageName] of [[new BuiltinShapesPlugin(), 'builtin-shapes'], [new BuiltinCommandsPlugin(), 'builtin-commands']]) {
            assert.deepEqual(await host.activate(plugin, JSON.parse(readFileSync(join(repository, `plugins/${packageName}/package.json`), 'utf8'))), []);
          }
          if (mode === 'code') {
            for (const [plugin, packageName] of [[new StatsPlugin(), 'stats'], [new DirPlugin(), 'dir'], [new BoxPlugin(), 'box'], [new TreeStarPlugin(), 'tree-star'], [new DiamondPlugin(), 'diamond']]) {
              assert.deepEqual(await host.activate(plugin, JSON.parse(readFileSync(join(repository, `plugins/${packageName}/package.json`), 'utf8'))), []);
            }
          } else assert.deepEqual(await new PluginLoader(host).load(join(repository, 'doc/transcript/basic.config.json')), []);
          const chunks = [];
          const stream = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
          await new Repl(host.dispatcher).run(Readable.from([input]), stream, false);
          assert.equal(host.dispatcher.hadErrors, false); assert.equal(host.dispatcher.stopped, true);
          output.push(Buffer.concat(chunks)); saved.push(readFileSync(join(working, savedFile)));
          writeFileSync(join(root, `${name}.${mode}.txt`), output.at(-1));
        }
        assert.deepEqual(output[0], output[1]); assert.deepEqual(saved[0], saved[1]);
        results.push({ name, code: output[0], config: output[1], svg: saved[0] });
      }
    } finally { process.chdir(previous); }
    return results;
  }
}
