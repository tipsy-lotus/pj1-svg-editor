import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
import { BoxPlugin } from '../dist/plugins/box/src/BoxPlugin.js';
import { Box } from '../dist/plugins/box/src/Box.js';

export class BoxReplay {
  async run() {
    const repository = fileURLToPath(new URL('../', import.meta.url));
    const source = readFileSync(join(repository, 'doc/transcript/box.txt'), 'utf8');
    mkdirSync(join(repository, '.cache'), { recursive: true });
    const root = mkdtempSync(join(repository, '.cache/box-session-'));
    const previous = process.cwd(); const outputs = []; const saved = [];
    try {
      // 两次使用同一目录和同一保存路径，第二次重新 init 后覆盖保存。
      process.chdir(root);
      for (const mode of ['code', 'config']) {
        const shapes = new ShapeFactory();
        const session = new EditorSession(new SvgFileRepository(new NodeFileStore(), new SvgCodec(shapes)));
        const host = new PluginHost(session, shapes);
        for (const [plugin, name] of [[new BuiltinShapesPlugin(), 'builtin-shapes'], [new BuiltinCommandsPlugin(), 'builtin-commands']]) {
          assert.deepEqual(await host.activate(plugin, JSON.parse(readFileSync(join(repository, `plugins/${name}/package.json`), 'utf8'))), []);
        }
        if (mode === 'code') assert.deepEqual(await host.activate(new BoxPlugin(), JSON.parse(readFileSync(join(repository, 'plugins/box/package.json'), 'utf8'))), []);
        else assert.deepEqual(await new PluginLoader(host).load(join(repository, 'doc/transcript/box.config.json')), []);
        const chunks = [];
        const output = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
        await new Repl(host.dispatcher).run(Readable.from([source]), output, false);
        assert.equal(host.dispatcher.hadErrors, false); assert.equal(host.dispatcher.stopped, true);
        assert.equal(session.document.all().length, 8);
        assert.ok(session.document.find('n1') instanceof Box); assert.ok(session.document.find('n2') instanceof Box);
        assert.equal(session.document.find('n2-rect').attributes.x, '520');
        assert.equal(session.document.find('n2-rect').attributes.y, '100');
        assert.equal(session.document.find('n2-rect').attributes.fill, '#f5a623');
        assert.equal(session.document.find('n2-label').text, '处理数据');
        outputs.push(Buffer.concat(chunks)); saved.push(readFileSync(join(root, 'flowchart-box.svg')));
        writeFileSync(join(root, mode + '.txt'), outputs.at(-1));
      }
    } finally { process.chdir(previous); }
    assert.deepEqual(outputs[0], outputs[1]); assert.deepEqual(saved[0], saved[1]);
    return { code: outputs[0], config: outputs[1], svg: saved[0] };
  }
}
