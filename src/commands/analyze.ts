import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

/** Heuristic: does the text look like alphabetic text with preserved spacing? */
function looksLikeRotationalText(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 40) return false;

  const printable = text.replace(/[^\x20-\x7e\r\n\t]/g, '');
  const printableRatio = printable.length / Math.max(1, text.length);
  const wordLikeTokens = text.split(/\s+/g).filter(token => /[A-Za-z]{2,}/.test(token));
  return printableRatio > 0.9 && wordLikeTokens.length >= 8;
}

/** Rough frequency analysis hint. */
function mostFrequentLetters(text: string): string {
  const freq: Record<string, number> = {};
  for (const ch of text.toUpperCase().replace(/[^A-Z]/g, '')) {
    freq[ch] = (freq[ch] ?? 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ch]) => ch)
    .join(', ');
}

export function analyzeCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;

  if (cmd.args.length === 0) {
    return [out('Usage: analyze <file>', 'error')];
  }

  const target = vfs.resolve(state.currentPath, cmd.args[0]);
  const nodeType = vfs.getNodeType(target);

  if (nodeType === null) {
    return [out(`analyze: ${cmd.args[0]}: no such file or directory`, 'error')];
  }
  if (nodeType === 'dir') {
    return [out(`analyze: ${cmd.args[0]}: is a directory`, 'error')];
  }

  const access = checkFileAccess(state, vfs, target);
  if (!access.allowed) {
    return [
      out(`analyze: ${target}: access denied`, 'error'),
      out(access.reason, 'dim'),
    ];
  }

  const content = vfs.readFile(target) ?? '';
  const lines: OutputLine[] = [
    out(''),
    out(`Analyzing: ${cmd.args[0]}`, 'bright'),
    out('─────────────────────────────────────', 'dim'),
  ];

  const byteCount = new TextEncoder().encode(content).length;
  lines.push(out(`  Size      : ${byteCount} bytes`, 'normal'));
  lines.push(out(`  Lines     : ${content.split('\n').length}`, 'normal'));

  const hasPrintable = /[A-Za-z]/.test(content);
  if (!hasPrintable) {
    lines.push(out('  Type      : binary / unknown', 'warning'));
    lines.push(out('  No recognizable cipher pattern.', 'dim'));
    return lines;
  }

  if (looksLikeRotationalText(content)) {
    lines.push(out('  Type      : text - rotational substitution', 'warning'));
    lines.push(out('  Top chars : ' + mostFrequentLetters(content), 'dim'));
    lines.push(out('  Pattern   : alphabet wheel; spacing survived', 'dim'));
    lines.push(out(''));
    lines.push(out('  Wheel probe:', 'bright'));
    lines.push(out('    alphabet halves oppose each other cleanly', 'normal'));
    lines.push(out('    the lock has no favored direction', 'normal'));
    lines.push(out('    old field name: caesar', 'dim'));
  } else {
    lines.push(out('  Type      : plain text or unknown encoding', 'normal'));
    lines.push(out('  No strong cipher signature detected.', 'dim'));
  }

  lines.push(out(''));
  return lines;
}
