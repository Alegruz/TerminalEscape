import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import {
  SHIP_DIAGNOSTICS,
  severityColor,
  severityLabel,
  stateLabel,
} from '../data/diagnostics.ts';

export function statusCommand(
  _cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state } = ctx;
  const remainingMs = state.getRemainingTimeMs();
  const remainingText = remainingMs === null ? 'UNKNOWN' : formatTime(remainingMs);

  const lines: OutputLine[] = [
    out(''),
    out('═══════════════════════════════════', 'dim'),
    out(' ARES-7  SYSTEM DIAGNOSTICS', 'bright'),
    out('═══════════════════════════════════', 'dim'),
    out(''),
  ];

  if (state.flags.endingReached) {
    lines.push(out('  IMPACT  : CLEARED', 'bright'));
    lines.push(out('  NAV     : NOMINAL', 'system'));
    lines.push(out(''));
    return lines;
  }

  if (state.flags.crashReached) {
    lines.push(out('  IMPACT  : EVENT RECORDED', 'error'));
    lines.push(out('  SHIP    : LOST', 'error'));
    lines.push(out(''));
    return lines;
  }

  lines.push(out(`  IMPACT  : ${remainingText}`, 'warning'));
  lines.push(out(''));

  for (const system of SHIP_DIAGNOSTICS.systems) {
    const repaired = system.repairedWhen === null ? false : state.flags[system.repairedWhen];
    const unlocked = state.flags.navUnlocked && system.unlockedState !== undefined;
    const displayState = repaired
      ? 'NOMINAL'
      : unlocked
        ? system.unlockedState
        : stateLabel(system.state);
    const displaySeverity = repaired ? 'INFO' : severityLabel(system.severity);
    const color = repaired ? 'system' : severityColor(system.severity);
    const cause = unlocked ? system.unlockedCause : system.cause;

    lines.push(out(`  ${displaySeverity.padEnd(5)} ${system.label.padEnd(14)} ${displayState}`, color));
    if (!repaired && cause) {
      lines.push(out(`        ${cause}`, 'dim'));
    }
  }
  lines.push(out(''));

  return lines;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
