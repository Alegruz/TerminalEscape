import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

export function headCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return readLines(cmd, ctx, 'head');
}

export function tailCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return readLines(cmd, ctx, 'tail');
}

function readLines(
  cmd: ParsedCommand,
  ctx: CommandContext,
  mode: 'head' | 'tail',
): OutputLine[] {
  const { state, vfs } = ctx;
  if (cmd.args.length === 0) return [out(`Usage: ${mode} [-n count] <file>`, 'error')];

  const count = parseCount(cmd.flags['n']);
  const fileArg = cmd.args[0];
  const target = vfs.resolve(state.currentPath, fileArg);
  const nodeType = vfs.getNodeType(target);
  if (nodeType === null) return [out(`${mode}: ${fileArg}: no such file or directory`, 'error')];
  if (nodeType === 'dir') return [out(`${mode}: ${fileArg}: is a directory`, 'error')];

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`${mode}: ${target}: access denied`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const lines = (vfs.readFile(target) ?? '').split('\n');
  const selected = mode === 'head' ? lines.slice(0, count) : lines.slice(-count);
  return [out(''), ...selected.map(line => out(line, 'normal'))];
}

function parseCount(value: string | boolean | undefined): number {
  if (typeof value !== 'string') return 10;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10;
}
