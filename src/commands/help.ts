import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { getCommandHelp, getVisibleCommandCatalog } from './CommandCatalog.ts';
import type { CommandCatalogEntry } from './CommandCatalog.ts';

export function helpCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  if (cmd.args.length > 0) {
    const target = cmd.args[0].toLowerCase();
    const info = getCommandHelp(target, ctx.state);
    if (!info) {
      return [out(`No help entry for '${target}'.`, 'error')];
    }
    return [
      out(''),
      out(`${target}`, 'bright'),
      out(`  ${info.description}`, 'normal'),
      out(''),
      out(`  Usage:    ${info.usage}`, 'dim'),
      out('  Examples:', 'dim'),
      ...info.examples.map(e => out(`    ${e}`, 'normal')),
      out(''),
    ];
  }

  const lines: OutputLine[] = [
    out(''),
    out('Available commands:', 'bright'),
    out(''),
  ];
  for (const info of orderCommandsForState(getVisibleCommandCatalog(ctx.state), ctx)) {
    lines.push(out(`  ${info.name.padEnd(10)} ${info.description}`, 'normal'));
  }
  lines.push(out(''));
  lines.push(out("Type 'help <command>' for usage details.", 'dim'));
  if (ctx.state.flags.timerStarted && !ctx.state.flags.shutdownStopped) {
    lines.push(out(''));
    lines.push(out('Wipe cancellation path:', 'warning'));
    lines.push(out('  shutdown --cancel', 'normal'));
    lines.push(out('  sudo shutdown --cancel', 'normal'));
    lines.push(out('Use the normal shutdown request first; sudo requires a password.', 'dim'));
    lines.push(out('Idle display process remains available: screensaver', 'dim'));
  } else if (!ctx.state.flags.helpSeen) {
    ctx.state.flags.helpSeen = true;
    lines.push(out(''));
    lines.push(out('BastionOS includes one local game for recovery sessions.', 'system'));
    lines.push(out("It is probably safe. Type 'tiles' if you need something to do.", 'dim'));
  } else if (ctx.state.flags.tilesStarted && !ctx.state.flags.tilesCrashed) {
    lines.push(out(''));
    lines.push(out("Tiles is still open. Slide a tile with 'tiles <number>'.", 'system'));
  }
  lines.push(out(''));
  return lines;
}

function orderCommandsForState(
  commands: CommandCatalogEntry[],
  ctx: CommandContext,
): CommandCatalogEntry[] {
  const order = ctx.state.flags.timerStarted && !ctx.state.flags.shutdownStopped
    ? ['shutdown', 'sudo', 'analyze', 'decrypt', 'screensaver', 'ls', 'cat', 'cd', 'help', 'tiles']
    : ['help', 'tiles', 'screensaver', 'ls', 'cat', 'cd', 'analyze', 'decrypt', 'shutdown', 'sudo'];
  const rank = new Map(order.map((name, index) => [name, index]));

  return [...commands].sort((a, b) => {
    const rankA = rank.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const rankB = rank.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB || a.name.localeCompare(b.name);
  });
}
