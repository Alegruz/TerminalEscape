import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

export function stringsCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;
  if (cmd.args.length === 0) return [out('Usage: strings <file>', 'error')];

  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  const nodeType = vfs.getNodeType(target);
  if (nodeType === null) return [out(`strings: ${cmd.args[0]}: no such file or directory`, 'error')];
  if (nodeType === 'dir') return [out(`strings: ${cmd.args[0]}: is a directory`, 'error')];

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`strings: ${target}: access denied`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const matches = (vfs.readFile(target) ?? '').match(/[ -~]{4,}/g) ?? [];
  return [out(''), ...matches.map(value => out(value, 'normal'))];
}
