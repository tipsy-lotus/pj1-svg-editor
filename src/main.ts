import { EditorSession } from './application/EditorSession.js';
import { Repl } from './cli/Repl.js';
import { NodeFileStore } from './io/NodeFileStore.js';
import { SvgFileRepository } from './io/SvgFileRepository.js';
import { SvgCodec } from './io/SvgCodec.js';
import { ShapeFactory } from './model/ShapeFactory.js';
import { PluginHost } from './host/PluginHost.js';
import { BuiltinShapesPlugin } from '../plugins/builtin-shapes/src/BuiltinShapesPlugin.js';
import { BuiltinCommandsPlugin } from '../plugins/builtin-commands/src/BuiltinCommandsPlugin.js';
import { readFileSync } from 'node:fs';
import type { PluginManifest } from './host/PluginManifest.js';
import { PluginLoader } from './host/PluginLoader.js';

const shapes = new ShapeFactory();
const session = new EditorSession(new SvgFileRepository(new NodeFileStore(), new SvgCodec(shapes)));
const host = new PluginHost(session, shapes);
const dispatcher = host.dispatcher;
try {
  const builtins = [
    { plugin: new BuiltinShapesPlugin(), manifest: '../../plugins/builtin-shapes/package.json' },
    { plugin: new BuiltinCommandsPlugin(), manifest: '../../plugins/builtin-commands/package.json' },
  ];
  for (const builtin of builtins) {
    const manifest = JSON.parse(readFileSync(new URL(builtin.manifest, import.meta.url), 'utf8')) as PluginManifest;
    for (const error of await host.activate(builtin.plugin, manifest)) process.stderr.write(error + '\n');
  }
  const args = process.argv.slice(2);
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--config') process.stderr.write('error: invalid plugin config\n');
    else for (const error of await new PluginLoader(host).load(args[1]!)) process.stderr.write(error + '\n');
  }
  await new Repl(dispatcher).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
  if (dispatcher.hadErrors) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message.replace(/[\r\n\t]/g, ' ')}\n`);
  process.exitCode = 1;
}
