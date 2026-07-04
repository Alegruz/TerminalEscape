import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';

export function clearCommand(
  _cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  ctx.buffer.clear();
  return [];
}
