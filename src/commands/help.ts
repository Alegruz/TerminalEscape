import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { getCommandHelp, getVisibleCommandCatalog } from './CommandCatalog.ts';

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
  for (const info of getVisibleCommandCatalog(ctx.state)) {
    lines.push(out(`  ${info.name.padEnd(10)} ${info.description}`, 'normal'));
  }
  lines.push(out(''));
  lines.push(out("Type 'help <command>' for usage details.", 'dim'));
  if (!ctx.state.flags.helpSeen) {
    ctx.state.flags.helpSeen = true;
    lines.push(out(''));
    lines.push(out('BastionOS includes one local game for recovery sessions.', 'system'));
    lines.push(out("It is probably safe. Type 'tiles' if you need something to do.", 'dim'));
  } else if (ctx.state.flags.tilesStarted && !ctx.state.flags.tilesCrashed) {
    lines.push(out(''));
    lines.push(out("Tiles is still open. Slide a tile with 'tiles <number>'.", 'system'));
  } else if (ctx.state.flags.tilesCrashed && !ctx.state.flags.entityIntroduced) {
    lines.push(out(''));
    lines.push(out('Emergency controls exposed by policy:', 'warning'));
    lines.push(out('  shutdown --cancel', 'normal'));
    lines.push(out('Wipe cancellation requires sudo access.', 'dim'));
  }
  lines.push(out(''));
  return lines;
}
