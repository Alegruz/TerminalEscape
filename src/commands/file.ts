import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

export function fileCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;
  if (cmd.args.length === 0) return [out('Usage: file <path>', 'error')];

  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  const nodeType = vfs.getNodeType(target);
  if (nodeType === null) return [out(`file: ${cmd.args[0]}: no such file or directory`, 'error')];
  if (nodeType === 'dir') return [out(`${cmd.args[0]}: directory`, 'bright')];

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`${cmd.args[0]}: restricted data`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const content = vfs.readFile(target) ?? '';
  const hasText = /^[\t\n\r -~]*$/.test(content);
  const bytes = new TextEncoder().encode(content).length;
  return [
    out(`${cmd.args[0]}: ${hasText ? 'text data' : 'data'} (${bytes} bytes)`, 'normal'),
  ];
}
