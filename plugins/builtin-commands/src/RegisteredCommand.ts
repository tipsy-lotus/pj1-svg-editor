import type { Command } from '../../../src/extensions/Command.js';
import type { Token } from '../../../src/cli/Token.js';

export class RegisteredCommand implements Command {
  constructor(
    readonly name: string,
    readonly syntax: string,
    readonly minimum: number,
    readonly maximum: number,
    private readonly operation: (args: readonly Token[]) => string | readonly string[],
  ) {}
  run(args: readonly Token[]): string | readonly string[] { return this.operation(args); }
}
