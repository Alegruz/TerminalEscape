import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const ROOT_PASSWORD = 'perhapsaps';

const WIN_LINES: OutputLine[] = [
  out(''),
  out('[sudo] password accepted', 'system'),
  out('[ SYSTEM WIPE CANCELLED ]', 'bright'),
  out(''),
  out('The entity is quiet for one full second.', 'normal'),
  out('Then it types without touching your keyboard.', 'warning'),
  out(''),
];

export function sudoCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state } = ctx;

  const action = cmd.args[0]?.toLowerCase();
  const mode = cmd.args[1]?.toLowerCase();
  const password = cmd.args[2] ?? '';

  if (action !== 'shutdown' || mode !== '--cancel') {
    return [
      out('Usage: sudo shutdown --cancel <password>', 'error'),
      out('Only the wipe daemon accepts sudo in this terminal.', 'dim'),
    ];
  }

  if (!password) {
    return [
      out('[sudo] password required', 'error'),
      out('Combine the recovered fragments and try again.', 'dim'),
    ];
  }

  if (password.toLowerCase() !== ROOT_PASSWORD) {
    return [
      out('[sudo] authentication failure', 'error'),
      out('The entity hisses: not that word.', 'dim'),
    ];
  }

  state.flags.shutdownStopped = true;
  state.flags.endingReached = true;
  state.stage = 'complete';
  return WIN_LINES;
}
