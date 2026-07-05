import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function sudoCommand(
  cmd: ParsedCommand,
  _ctx: CommandContext,
): OutputLine[] {
  const action = cmd.args[0]?.toLowerCase();
  const cancelRequested = cmd.flags.cancel === true || cmd.args[1]?.toLowerCase() === '--cancel';
  const wipeRequested = cmd.flags.wipe === true || cmd.args[1]?.toLowerCase() === '--wipe';

  if (action !== 'shutdown' || (!cancelRequested && !wipeRequested)) {
    return [
      out('Usage: sudo shutdown --cancel', 'error'),
      out('       sudo shutdown --wipe', 'error'),
      out('Only the wipe daemon accepts sudo in this terminal.', 'dim'),
    ];
  }

  return [];
}
