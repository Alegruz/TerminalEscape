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

export function authCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, puzzles } = ctx;

  const { target, code } = parseAuthArgs(cmd);
  if (!code) {
    return [
      out('Usage: auth <system> <access-code>', 'error'),
      out('authorization code required by restricted subsystem', 'dim'),
    ];
  }

  if (target !== 'nav' && target !== 'navigation') {
    return [out(`auth: ${target}: unknown restricted subsystem`, 'error')];
  }

  const puzzle = puzzles.checkAnswer(code);
  if (puzzle) {
    state.flags.navUnlocked = true;
    return ACCESS_GRANTED_LINES;
  }

  if (!state.flags.emergencyDecrypted) {
    return [
      out('Authorization denied. Code is incorrect.', 'error'),
      out('Emergency broadcast contents may contain authorization material.', 'dim'),
    ];
  }

  return [
    out('Authorization denied. Code is incorrect.', 'error'),
    out('Check the decrypted broadcast for the exact access code.', 'dim'),
  ];
}

function parseAuthArgs(cmd: ParsedCommand): { target: string; code: string } {
  if (cmd.args.length === 1) {
    return { target: 'nav', code: cmd.args[0] };
  }

  return {
    target: (cmd.args[0] ?? 'nav').toLowerCase(),
    code: cmd.args.slice(1).join(' '),
  };
}
