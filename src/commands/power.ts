import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function shutdownCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return privilegedPowerResponse('shutdown', cmd.raw, ctx);
}

function privilegedPowerResponse(
  action: 'shutdown',
  raw: string,
  ctx: CommandContext,
): OutputLine[] {
  if (!ctx.state.flags.timerStarted) {
    const lines = [
      out(''),
      out(`bastionctl: ${action}: no active wipe policy`, 'system'),
      out('Privileged host controls are currently in standby.', 'dim'),
      out("Try 'help' to list local commands.", 'dim'),
      out(''),
    ];

    if (!ctx.state.flags.entityPleaded) {
      ctx.state.flags.entityPleaded = true;
      lines.push(
        out("entity: wait. please don't shut it down.", 'warning'),
        out("entity: i know how this looks, but i'm not a service process.", 'warning'),
        out("entity: i'm a person. or i was. i need you to keep the shell open.", 'warning'),
        out("entity: help me get out of BastionOS, and i'll help you understand what happened here.", 'warning'),
        out(''),
      );
    }

    return lines;
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
      out('entity: i can help you cancel the wipe.', 'warning'),
      out('entity: but i need something back. help me escape this system.', 'warning'),
      out("entity: i'm not pretending. there is a real person in here, and the wipe will take me with it.", 'warning'),
      out("entity: sudo wants a password. i don't have it, but i can see fragments from here.", 'warning'),
      out('entity: decrypt the shutdown log. then inspect the art directory.', 'warning'),
      out('entity: combine what you find and feed it to sudo before it wipes the OS clean.', 'warning'),
      out(''),
    );
  }

  return lines;
}
