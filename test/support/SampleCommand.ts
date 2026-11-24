import type { Command } from '../../src/extensions/Command.js';
import type { Token } from '../../src/cli/Token.js';

export class SampleCommand implements Command {
  readonly name = 'echo';
  readonly syntax = 'echo <text>';
  readonly minimum = 1;
  readonly maximum = 1;
  run(args: readonly Token[]): string { return args[0]!.value; }
}
