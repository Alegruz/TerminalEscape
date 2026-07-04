import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const NAV_CORE_PATH = '/systems/nav_core.dat';

const WIN_LINES: OutputLine[] = [
  out(''),
  out('╔════════════════════════════════════════════╗', 'bright'),
  out('║        NAVIGATION RESTORED  ✓              ║', 'bright'),
  out('╠════════════════════════════════════════════╣', 'bright'),
  out('║                                            ║', 'bright'),
  out('║   Core checksum rebuilt.                   ║', 'system'),
  out('║   Escape trajectory calculated.            ║', 'system'),
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

export function repairCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;

  if (cmd.args.length === 0) {
    return [
      out('Usage: repair <target>', 'error'),
      out('repair target required', 'dim'),
    ];
  }

  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  if (target !== NAV_CORE_PATH && cmd.args[0].toLowerCase() !== 'nav') {
    return [out(`repair: ${cmd.args[0]}: unsupported repair target`, 'error')];
  }

  if (!state.flags.navUnlocked) {
    return [
      out('repair: navigation core access denied', 'error'),
      out('authorization required before repair routines can run', 'dim'),
    ];
  }

  state.flags.navRepaired = true;
  state.flags.endingReached = true;
  state.stage = 'complete';
  return WIN_LINES;
}
