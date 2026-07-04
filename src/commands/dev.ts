import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const DEFAULT_FX_SECONDS = 12;
const DEFAULT_FX_INTENSITY = 1;
const MAX_FX_SECONDS = 60;
const MIN_TIMER_SPEED = 0.01;
const MAX_TIMER_SPEED = 120;

export function devFxCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const seconds = parseOptionalNumber(cmd.args[0], DEFAULT_FX_SECONDS);
  const intensity = parseOptionalNumber(cmd.args[1], DEFAULT_FX_INTENSITY);

  if (seconds === null || seconds <= 0 || seconds > MAX_FX_SECONDS) {
    return [out(`usage: dev-fx [seconds 1-${MAX_FX_SECONDS}] [intensity 0-1]`, 'error')];
  }
  if (intensity === null || intensity < 0 || intensity > 1) {
    return [out('usage: dev-fx [seconds] [intensity 0-1]', 'error')];
  }

  ctx.state.triggerDevInstability(seconds * 1000, intensity);
  return [out(`[ DEV ] terminal instability ${intensity.toFixed(2)} for ${seconds.toFixed(1)}s`, 'system')];
}

export function devSpeedCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const multiplier = parseOptionalNumber(cmd.args[0], Number.NaN);
  if (
    multiplier === null ||
    !Number.isFinite(multiplier) ||
    multiplier < MIN_TIMER_SPEED ||
    multiplier > MAX_TIMER_SPEED
  ) {
    return [out(`usage: dev-speed <multiplier ${MIN_TIMER_SPEED}-${MAX_TIMER_SPEED}>`, 'error')];
  }

  ctx.state.setMissionTimerSpeed(multiplier);
  return [out(`[ DEV ] mission timer speed set to ${multiplier.toFixed(2)}x`, 'system')];
}

function parseOptionalNumber(value: string | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
