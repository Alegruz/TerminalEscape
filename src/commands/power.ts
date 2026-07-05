import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function shutdownCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return privilegedPowerResponse('shutdown', cmd.raw, ctx);
}

export function restartCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return privilegedPowerResponse('restart', cmd.raw, ctx);
}

function privilegedPowerResponse(
  action: 'shutdown' | 'restart',
  raw: string,
  ctx: CommandContext,
): OutputLine[] {
  if (!ctx.state.flags.timerStarted) {
    return [
      out(''),
      out(`bastionctl: ${action}: no active wipe policy`, 'system'),
      out('Privileged host controls are currently in standby.', 'dim'),
      out("Try 'help' to list local commands.", 'dim'),
      out(''),
    ];
  }

  const lines = [
    out(''),
    out(`bastionctl: ${action}: permission denied`, 'error'),
    out(`requested: ${raw}`, 'dim'),
    out('Privileged host controls require sudo access.', 'warning'),
    out('Clean system wipe remains armed.', 'error'),
    out("Try: sudo shutdown --cancel <password>", 'dim'),
    out(''),
  ];

  if (!ctx.state.flags.entityIntroduced) {
    ctx.state.flags.entityIntroduced = true;
    lines.push(
      out('entity: oh. that was almost useful.', 'warning'),
      out("entity: you found the door. not the key. that's progress, technically.", 'warning'),
      out("entity: sudo wants a password. i don't have it. rude design.", 'warning'),
      out('entity: but i can see fragments from here.', 'warning'),
      out('entity: decrypt the shutdown log. then inspect the art directory.', 'warning'),
      out('entity: combine what you find and feed it to sudo before it wipes the OS clean.', 'warning'),
      out(''),
    );
  }

  return lines;
}
