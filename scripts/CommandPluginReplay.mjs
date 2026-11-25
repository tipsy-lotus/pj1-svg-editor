import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

/** 用实际领域、文件适配器和 REPL 回放，两种装配只在最外层不同。 */
export class CommandPluginReplay {
  async run() {
    const repository = fileURLToPath(new URL('../', import.meta.url));
    const source = readFileSync(join(repository, 'doc/transcript/command-plugins.txt'), 'utf8');
    mkdirSync(join(repository, '.cache'), { recursive: true });
    const root = mkdtempSync(join(repository, '.cache/command-session-'));
    const working = join(root, 'working'); mkdirSync(working); mkdirSync(join(working, 'docs'));
    writeFileSync(join(working, '.hidden'), '');
    copyFileSync(join(repository, 'doc/transcript/fixtures/command-input.svg'), join(working, 'example.svg'));
    const initial = readdirSync(working).sort();
    const previous = process.cwd(); const outputs = [];
    const saved = [];
    try {
      process.chdir(working);
      for (const mode of ['code', 'config']) {
        const shapes = new ShapeFactory();
        const session = new EditorSession(new SvgFileRepository(new NodeFileStore(), new SvgCodec(shapes)));
        const host = new PluginHost(session, shapes);
        for (const [plugin, name] of [[new BuiltinShapesPlugin(), 'builtin-shapes'], [new BuiltinCommandsPlugin(), 'builtin-commands']]) {
          const manifest = JSON.parse(readFileSync(join(repository, `plugins/${name}/package.json`), 'utf8'));
          assert.deepEqual(await host.activate(plugin, manifest), []);
        }
        if (mode === 'code') {
          for (const [plugin, name] of [[new StatsPlugin(), 'stats'], [new DirPlugin(), 'dir']]) {
            const manifest = JSON.parse(readFileSync(join(repository, `plugins/${name}/package.json`), 'utf8'));
            assert.deepEqual(await host.activate(plugin, manifest), []);
          }
        } else assert.deepEqual(await new PluginLoader(host).load(join(repository, 'doc/transcript/command-plugins.config.json')), []);
        const chunks = [];
        const output = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
        await new Repl(host.dispatcher).run(Readable.from([source]), output, false);
        assert.equal(host.dispatcher.hadErrors, false);
        assert.equal(host.dispatcher.stopped, true);
        outputs.push(Buffer.concat(chunks)); saved.push(readFileSync(join(root, 'session.svg')));
        assert.deepEqual(readdirSync(working).sort(), initial);
        writeFileSync(join(root, mode + '.txt'), outputs.at(-1));
      }
    } finally { process.chdir(previous); }
    assert.deepEqual(outputs[0], outputs[1]); assert.deepEqual(saved[0], saved[1]);
    return { code: outputs[0], config: outputs[1], svg: saved[0], root: resolve(root) };
  }
}
