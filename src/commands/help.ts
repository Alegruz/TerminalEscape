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
    const info = getCommandHelp(target);
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
  for (const info of getVisibleCommandCatalog()) {
    lines.push(out(`  ${info.name.padEnd(10)} ${info.description}`, 'normal'));
  }
  lines.push(out(''));
  lines.push(out("Type 'help <command>' for usage details.", 'dim'));
  if (!ctx.state.flags.helpSeen) {
    ctx.state.flags.helpSeen = true;
    lines.push(out(''));
    lines.push(out('entity: good. you can read.', 'warning'));
    lines.push(out('entity: the host is counting down to shutdown.', 'warning'));
    lines.push(out('entity: sudo can stop it, but the password was split.', 'warning'));
    lines.push(out('entity: decrypt the log. find what is hidden in the drawing.', 'warning'));
    lines.push(out('entity: combine the fragments. use them before the timer ends.', 'warning'));
  }
  lines.push(out(''));
  return lines;
}
