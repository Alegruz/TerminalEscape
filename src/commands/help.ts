import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { COMMAND_CATALOG, getCommandHelp } from './CommandCatalog.ts';

export function helpCommand(
  cmd: ParsedCommand,
  _ctx: CommandContext,
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
  for (const info of COMMAND_CATALOG) {
    lines.push(out(`  ${info.name.padEnd(10)} ${info.description}`, 'normal'));
  }
  lines.push(out(''));
  lines.push(out("Type 'help <command>' for usage details.", 'dim'));
  lines.push(out(''));
  return lines;
}
