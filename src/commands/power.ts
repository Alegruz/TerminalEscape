import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function shutdownCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return shutdownResponse(cmd, ctx);
}

function shutdownResponse(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  if (!ctx.state.flags.timerStarted) {
    return [
      out(''),
      out('bastionctl: shutdown: request received', 'system'),
      out('No active wipe policy is running. Host shutdown remains in standby.', 'dim'),
      out("Try 'help' to list local commands.", 'dim'),
      out(''),
    ];
  }

  const lines = [
    out(''),
    out('bastionctl: shutdown: ignored', 'error'),
    out(`requested: ${cmd.raw}`, 'dim'),
    out('Clean system wipe is already controlled by recovery policy.', 'error'),
    out('User-level shutdown cannot interrupt the wipe sequence.', 'warning'),
    out("To cancel the wipe, use: sudo shutdown --cancel", 'dim'),
    out(''),
  ];

  return lines;
}
