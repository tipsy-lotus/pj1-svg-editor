import { EditorSession } from './application/EditorSession.js';
import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { Repl } from './cli/Repl.js';
import { NodeFileStore } from './io/NodeFileStore.js';
import { SvgFileRepository } from './io/SvgFileRepository.js';

const session = new EditorSession(new SvgFileRepository(new NodeFileStore()));
const dispatcher = new CommandDispatcher(session);
try {
  await new Repl(dispatcher).run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
  if (dispatcher.hadErrors) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message.replace(/[\r\n\t]/g, ' ')}\n`);
  process.exitCode = 1;
}
