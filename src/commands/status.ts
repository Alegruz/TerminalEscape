import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function statusCommand(
  _cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state } = ctx;

  const lines: OutputLine[] = [
    out(''),
    out('═══════════════════════════════════', 'dim'),
    out(' ARES-7  MISSION STATUS', 'bright'),
    out('═══════════════════════════════════', 'dim'),
    out(''),
  ];

  if (state.flags.endingReached) {
    lines.push(out('  STATUS  : COMPLETE', 'bright'));
    lines.push(out('  Navigation restored. Escape successful.', 'normal'));
    lines.push(out(''));
    return lines;
  }

  if (state.flags.emergencyDecrypted) {
    lines.push(out('  STATUS  : ACCESS CODE OBTAINED', 'bright'));
    lines.push(out('  Objective: Submit the navigation unlock code.', 'normal'));
    lines.push(out(''));
    lines.push(out('  Next step:', 'dim'));
    lines.push(out('    submit NOVA-7734', 'system'));
    lines.push(out(''));
  } else {
    lines.push(out('  STATUS  : CRITICAL — NAVIGATION OFFLINE', 'warning'));
    lines.push(out('  Objective: Decrypt the emergency broadcast.', 'normal'));
    lines.push(out(''));
    lines.push(out('  Next steps:', 'dim'));
    lines.push(out('    1.  cd /logs', 'system'));
    lines.push(out('    2.  cat crew_note.txt        (read hint)', 'system'));
    lines.push(out('    3.  analyze emergency.enc    (cipher info)', 'system'));
    lines.push(out('    4.  decrypt --method caesar --key 13 emergency.enc', 'system'));
    lines.push(out(''));
  }

  return lines;
}
