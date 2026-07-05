import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

export function cdCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;
  const target = cmd.args[0] ? vfs.resolve(state.currentPath, cmd.args[0]) : '/';
  const nodeType = vfs.getNodeType(target);

  if (nodeType === null) {
    return [out(`cd: ${cmd.args[0] ?? target}: no such file or directory`, 'error')];
  }
  if (nodeType !== 'dir') {
    return [out(`cd: ${cmd.args[0] ?? target}: not a directory`, 'error')];
  }

  state.currentPath = target;
  return [];
}
