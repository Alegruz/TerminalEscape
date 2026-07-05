import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function screensaverCommand(
  _cmd: ParsedCommand,
  _ctx: CommandContext,
): OutputLine[] {
  return [
    out('[ saver ] launching /art/screensaver.seq', 'system'),
  ];
}
