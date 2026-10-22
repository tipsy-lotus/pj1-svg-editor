import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { CommandDispatcher } from './CommandDispatcher.js';

export class Repl {
  constructor(private readonly dispatcher: CommandDispatcher) {}

  async run(input: Readable, output: Writable, interactive = false): Promise<void> {
    const reader = createInterface({ input, output, terminal: interactive, crlfDelay: Infinity });
    let closed = false;
    reader.once('close', () => { closed = true; });
    reader.on('SIGINT', () => reader.close());
    output.write("svg-editor 0.1 — type 'help' for commands\n");
    reader.setPrompt('svg> ');
    if (interactive) reader.prompt();
    try {
      for await (const line of reader) {
        const result = this.dispatcher.execute(line);
        if (result.length) output.write(result.join('\n') + '\n');
        if (this.dispatcher.stopped) break;
        if (interactive && !closed) reader.prompt();
      }
    } finally { reader.close(); }
  }
}
