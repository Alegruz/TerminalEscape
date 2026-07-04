import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { checkFileAccess } from '../fs/AccessControl.ts';

/** Heuristic: is the text predominantly uppercase letters (Caesar-like)? */
function looksLikeCaesar(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 10) return false;
  const uppers = letters.replace(/[^A-Z]/g, '').length;
  return uppers / letters.length > 0.75;
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

  if (looksLikeCaesar(content)) {
    lines.push(out('  Type      : text — possible substitution cipher', 'warning'));
    lines.push(out('  Top chars : ' + mostFrequentLetters(content), 'dim'));
    lines.push(out('  Pattern   : all-caps, single-char substitution', 'dim'));
    lines.push(out(''));
    lines.push(out('  Recommendation:', 'bright'));
    lines.push(out('    Likely Caesar-family substitution.', 'normal'));
    lines.push(
      out(`    decrypt --method caesar --key <number> ${cmd.args[0]}`, 'system'),
    );
  } else {
    lines.push(out('  Type      : plain text or unknown encoding', 'normal'));
    lines.push(out('  No strong cipher signature detected.', 'dim'));
  }

  lines.push(out(''));
  return lines;
}
