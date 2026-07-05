import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

export function decryptCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs, puzzles } = ctx;

  // Validate required flags.
  const method = cmd.flags['method'];
  const keyRaw = cmd.flags['key'];

  if (!method || method === true) {
    return [
      out('Missing --method flag.', 'error'),
      out('Usage: decrypt --method <method> --key <number> <file>', 'dim'),
      out('Supported methods: caesar', 'dim'),
    ];
  }
  if (!keyRaw || keyRaw === true) {
    return [
      out('Missing --key flag.', 'error'),
      out('Usage: decrypt --method <method> --key <number> <file>', 'dim'),
    ];
  }
  if (cmd.args.length === 0) {
    return [out('Missing file argument.', 'error')];
  }

  const key = parseInt(String(keyRaw), 10);
  if (isNaN(key)) {
    return [out(`Invalid key: '${String(keyRaw)}' is not a number.`, 'error')];
  }

  const methodStr = String(method).toLowerCase();
  if (methodStr !== 'caesar') {
    return [out(`Unknown method: '${methodStr}'.  Supported: caesar`, 'error')];
  }

  // Resolve file.
  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  const nodeType = vfs.getNodeType(target);

  if (nodeType === null) {
    return [out(`decrypt: ${cmd.args[0]}: no such file or directory`, 'error')];
  }
  if (nodeType === 'dir') {
    return [out(`decrypt: ${cmd.args[0]}: is a directory`, 'error')];
  }

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`decrypt: ${target}: access denied`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const content = vfs.readFile(target) ?? '';
  const decrypted = puzzles.decrypt(content, methodStr, key);

  if (decrypted === null) {
    return [out('Decryption failed: unsupported method.', 'error')];
  }

  const lines: OutputLine[] = [
    out(''),
    out(`[Decrypted with Caesar key=${key}]`, 'dim'),
    out('─────────────────────────────────────', 'dim'),
  ];
  for (const line of decrypted.split('\n')) {
    lines.push(out(line, 'bright'));
  }
  lines.push(out('─────────────────────────────────────', 'dim'));

  // Check if this solves a puzzle.
  const solved = puzzles.checkSolve(target, methodStr, key);
  if (solved) {
    state.flags[solved.solveFlag] = true;
    lines.push(out(''));
    lines.push(out('[DECRYPTION VERIFIED]', 'system'));
    lines.push(out('Password fragment recovered from shutdown log.', 'system'));
    lines.push(out(''));
  }

  return lines;
}
