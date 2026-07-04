import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const COMMAND_HELP: Record<
  string,
  { description: string; usage: string; examples: string[] }
> = {
  help: {
    description: 'Show available commands or help for a specific command.',
    usage: 'help [command]',
    examples: ['help', 'help decrypt', 'decrypt --help'],
  },
  ls: {
    description: 'List directory contents.',
    usage: 'ls [path]',
    examples: ['ls', 'ls /logs', 'ls ..'],
  },
  cd: {
    description: 'Change the current directory.',
    usage: 'cd <path>',
    examples: ['cd logs', 'cd /systems', 'cd ..', 'cd /'],
  },
  pwd: {
    description: 'Print the current working directory.',
    usage: 'pwd',
    examples: ['pwd'],
  },
  cat: {
    description: 'Print the contents of a file.',
    usage: 'cat <file>',
    examples: ['cat readme.txt', 'cat /logs/crew_note.txt'],
  },
  open: {
    description: 'Alias for cat — open and display a file.',
    usage: 'open <file>',
    examples: ['open readme.txt'],
  },
  clear: {
    description: 'Clear the terminal output.',
    usage: 'clear',
    examples: ['clear'],
  },
  status: {
    description: 'Show current ship diagnostics.',
    usage: 'status',
    examples: ['status'],
  },
  file: {
    description: 'Identify a file or directory.',
    usage: 'file <path>',
    examples: ['file readme.txt', 'file /systems/nav_core.dat'],
  },
  head: {
    description: 'Print the first lines of a file.',
    usage: 'head [-n count] <file>',
    examples: ['head readme.txt', 'head -n 5 /logs/crew_note.txt'],
  },
  tail: {
    description: 'Print the last lines of a file.',
    usage: 'tail [-n count] <file>',
    examples: ['tail readme.txt', 'tail -n 5 /logs/crew_note.txt'],
  },
  grep: {
    description: 'Search for text inside a file.',
    usage: 'grep <pattern> <file>',
    examples: ['grep status readme.txt', 'grep CORE /systems/nav.locked'],
  },
  strings: {
    description: 'Print printable strings from a file.',
    usage: 'strings <file>',
    examples: ['strings /logs/emergency.enc'],
  },
  scan: {
    description: 'Scan an unlocked component for repair faults.',
    usage: 'scan <target>',
    examples: ['scan nav_core.dat', 'scan /systems/nav_core.dat'],
  },
  analyze: {
    description: 'Analyze a file and report encryption details.',
    usage: 'analyze <file>',
    examples: ['analyze emergency.enc', 'analyze /logs/emergency.enc'],
  },
  decrypt: {
    description: 'Decrypt an encrypted file using the specified cipher method.',
    usage: 'decrypt --method <method> --key <number> <file>',
    examples: [
      'decrypt --method caesar --key <number> emergency.enc',
      'decrypt --method caesar --key <number> /logs/emergency.enc',
    ],
  },
  auth: {
    description: 'Authenticate against a restricted subsystem.',
    usage: 'auth <system> <access-code>',
    examples: ['auth nav <code>'],
  },
  repair: {
    description: 'Repair an unlocked damaged system component.',
    usage: 'repair <target>',
    examples: ['repair nav_core.dat', 'repair /systems/nav_core.dat'],
  },
};

export function helpCommand(
  cmd: ParsedCommand,
  _ctx: CommandContext,
): OutputLine[] {
  if (cmd.args.length > 0) {
    const target = cmd.args[0].toLowerCase();
    const info = COMMAND_HELP[target];
    if (!info) {
      return [out(`No help entry for '${target}'.`, 'error')];
    }
    return [
      out(''),
      out(`${target}`, 'bright'),
      out(`  ${info.description}`, 'normal'),
      out(''),
      out(`  Usage:    ${info.usage}`, 'dim'),
      out('  Examples:', 'dim'),
      ...info.examples.map(e => out(`    ${e}`, 'normal')),
      out(''),
    ];
  }

  // Full command list.
  const lines: OutputLine[] = [
    out(''),
    out('Available commands:', 'bright'),
    out(''),
  ];
  for (const [name, info] of Object.entries(COMMAND_HELP)) {
    lines.push(out(`  ${name.padEnd(10)} ${info.description}`, 'normal'));
  }
  lines.push(out(''));
  lines.push(out("Type 'help <command>' for usage details.", 'dim'));
  lines.push(out(''));
  return lines;
}
