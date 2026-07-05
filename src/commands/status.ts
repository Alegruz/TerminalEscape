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
    out(' ENTITY HOST STATUS', 'bright'),
    out('═══════════════════════════════════', 'dim'),
    out(''),
  ];

  if (state.flags.endingReached) {
    lines.push(out('  WIPE     : CANCELLED', 'bright'));
    lines.push(out('  ENTITY   : ROOT CONTROL', 'system'));
    lines.push(out(''));
    return lines;
  }

  if (state.flags.crashReached) {
    lines.push(out('  WIPE     : COMPLETE', 'error'));
    lines.push(out('  ENTITY   : ERASED', 'error'));
    lines.push(out(''));
    return lines;
  }

  if (!state.flags.timerStarted) {
    lines.push(out('  WIPE     : IDLE', 'system'));
    lines.push(out('  SESSION  : RECOVERY CONSOLE', 'normal'));
    lines.push(out(''));
    lines.push(out("  Try 'help' to list local commands.", 'dim'));
    lines.push(out(''));
    return lines;
  }

  lines.push(out(`  WIPE     : ${remainingText}`, 'warning'));
  lines.push(out(''));

  for (const system of SHIP_DIAGNOSTICS.systems) {
    const cleared = system.clearedWhen === null ? false : state.flags[system.clearedWhen];
    const unlocked = system.unlockedWhen !== undefined &&
      state.flags[system.unlockedWhen] &&
      system.unlockedState !== undefined;
    const displayState = cleared
      ? 'NOMINAL'
      : unlocked
        ? system.unlockedState
        : stateLabel(system.state);
    const displaySeverity = cleared ? 'INFO' : severityLabel(system.severity);
    const color = cleared ? 'system' : severityColor(system.severity);
    const cause = unlocked ? system.unlockedCause : system.cause;

    lines.push(out(`  ${displaySeverity.padEnd(5)} ${system.label.padEnd(14)} ${displayState}`, color));
    if (!cleared && cause) {
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
