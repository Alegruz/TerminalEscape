import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function catCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;

  if (cmd.args.length === 0) {
    return [out('Usage: cat <file>', 'error')];
  }

  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  const nodeType = vfs.getNodeType(target);

  if (nodeType === null) {
    return [out(`cat: ${cmd.args[0]}: no such file or directory`, 'error')];
  }
  if (nodeType === 'dir') {
    return [out(`cat: ${cmd.args[0]}: is a directory`, 'error')];
  }

  const content = vfs.readFile(target) ?? '';
  const lines: OutputLine[] = [out('')];
  for (const line of content.split('\n')) {
    lines.push(out(line, 'normal'));
  }
  return lines;
}
