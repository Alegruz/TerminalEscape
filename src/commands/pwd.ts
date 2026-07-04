import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function pwdCommand(
  _cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return [out(ctx.state.currentPath, 'normal')];
}
