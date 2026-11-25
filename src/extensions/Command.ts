import type { Token } from '../cli/Token.js';

/** 可调用的 CLI 命令，与 commands/Command 的可撤销编辑事务分开。 */
export interface Command {
  readonly name: string;
  readonly syntax: string;
  readonly minimum: number;
  readonly maximum: number;
  run(args: readonly Token[]): string | readonly string[];
}
