import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

export function scanCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;
  if (cmd.args.length === 0) return [out('Usage: scan <target>', 'error')];

  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  const nodeType = vfs.getNodeType(target);
  if (nodeType === null) return [out(`scan: ${cmd.args[0]}: no such file or directory`, 'error')];
  if (nodeType === 'dir') return [out(`scan: ${cmd.args[0]}: is a directory`, 'error')];

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`scan: ${target}: access denied`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const header = vfs.getFileHeader(target);
  if (header?.scanFlag) {
    state.flags[header.scanFlag] = true;
  }

  return [
    out(''),
    out(`[SCAN] ${target}`, 'bright'),
    out(header?.scanMessage ?? 'no repair faults identified', header?.scanFlag ? 'warning' : 'system'),
    out(''),
  ];
}
