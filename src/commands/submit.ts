import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const WIN_LINES: OutputLine[] = [
  out(''),
  out('╔════════════════════════════════════════════╗', 'bright'),
  out('║        NAVIGATION RESTORED  ✓              ║', 'bright'),
  out('╠════════════════════════════════════════════╣', 'bright'),
  out('║                                            ║', 'bright'),
  out('║   Authorization accepted.                  ║', 'system'),
  out('║   Escape pod trajectory calculated.        ║', 'system'),
  out('║   Autopilot engaged.                       ║', 'system'),
  out('║                                            ║', 'bright'),
  out('║   ETA to Earth Station Meridian: 14 days.  ║', 'normal'),
  out('║                                            ║', 'bright'),
  out('║          ★  YOU ESCAPED  ★                ║', 'bright'),
  out('║                                            ║', 'bright'),
  out('╚════════════════════════════════════════════╝', 'bright'),
  out(''),
  out('  Thanks for playing Terminal Escape!', 'dim'),
  out('  Refresh the page to play again.', 'dim'),
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
      out('Hint: Decrypt /logs/emergency.enc to find the code.', 'dim'),
    ];
  }

  const code = cmd.args.join(' ');
  const puzzle = puzzles.checkAnswer(code);

  if (puzzle) {
    state.flags.navUnlocked = true;
    state.flags.endingReached = true;
    state.stage = 'complete';
    return WIN_LINES;
  }

  // Wrong code but puzzle not yet solved — give more direction.
  if (!state.flags.emergencyDecrypted) {
    return [
      out(`Authorization denied.  Code '${code}' is incorrect.`, 'error'),
      out(''),
      out('Have you decrypted the emergency log yet?', 'dim'),
      out('  cd /logs  →  analyze emergency.enc  →  decrypt ...', 'dim'),
    ];
  }

  return [
    out(`Authorization denied.  Code '${code}' is incorrect.`, 'error'),
    out('Check the decrypted broadcast for the exact access code.', 'dim'),
  ];
}
