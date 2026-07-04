import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function lsCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;
  const target =
    cmd.args.length > 0
      ? vfs.resolve(state.currentPath, cmd.args[0])
      : state.currentPath;

  const entries = vfs.listDir(target);
  if (entries === null) {
    const nodeType = vfs.getNodeType(target);
    if (nodeType === 'file') {
      return [out(`ls: ${cmd.args[0] ?? target}: not a directory`, 'error')];
    }
    return [out(`ls: ${cmd.args[0] ?? target}: no such file or directory`, 'error')];
  }

  if (entries.length === 0) {
    return [out('(empty directory)', 'dim')];
  }

  const lines: OutputLine[] = [out('')];
  for (const name of entries) {
    const fullPath = target === '/' ? `/${name}` : `${target}/${name}`;
    const isDir = vfs.isDir(fullPath);
    lines.push(out(isDir ? `  ${name}/` : `  ${name}`, isDir ? 'bright' : 'normal'));
  }
  lines.push(out(''));
  return lines;
}
