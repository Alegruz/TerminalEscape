import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

export function grepCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;
  if (cmd.args.length < 2) return [out('Usage: grep <pattern> <file>', 'error')];

  const [pattern, fileArg] = cmd.args;
  const target = vfs.resolve(state.currentPath, fileArg);
  const nodeType = vfs.getNodeType(target);
  if (nodeType === null) return [out(`grep: ${fileArg}: no such file or directory`, 'error')];
  if (nodeType === 'dir') return [out(`grep: ${fileArg}: is a directory`, 'error')];

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`grep: ${target}: access denied`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const matches = (vfs.readFile(target) ?? '')
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.toLowerCase().includes(pattern.toLowerCase()));

  if (matches.length === 0) return [];
  return [
    out(''),
    ...matches.map(match => out(`${match.lineNumber}: ${match.line}`, 'normal')),
  ];
}
