import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const ACCESS_GRANTED_LINES: OutputLine[] = [
  out(''),
  out('[AUTHORIZATION ACCEPTED]', 'system'),
  out('Navigation core access granted.', 'normal'),
  out('Core checksum remains invalid. Repair required.', 'warning'),
  out(''),
  out('Inspect /systems/nav_core.dat for repair target details.', 'dim'),
  out(''),
];

export function submitCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, puzzles } = ctx;

  if (cmd.args.length === 0) {
    return [
      out('Usage: submit <access-code>', 'error'),
      out('authorization code required by navigation subsystem', 'dim'),
    ];
  }

  const code = cmd.args.join(' ');
  const puzzle = puzzles.checkAnswer(code);

  if (puzzle) {
    state.flags.navUnlocked = true;
    return ACCESS_GRANTED_LINES;
  }

  // Wrong code but puzzle not yet solved — give more direction.
  if (!state.flags.emergencyDecrypted) {
    return [
      out(`Authorization denied.  Code '${code}' is incorrect.`, 'error'),
      out(''),
      out('Have you decrypted the emergency log yet?', 'dim'),
      out('Emergency broadcast contents may contain authorization material.', 'dim'),
    ];
  }

  return [
    out(`Authorization denied.  Code '${code}' is incorrect.`, 'error'),
    out('Check the decrypted broadcast for the exact access code.', 'dim'),
  ];
}
