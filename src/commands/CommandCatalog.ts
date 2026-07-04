import type { CommandCompletionSpec } from '../terminal/CommandRegistry.ts';

export interface CommandHelpEntry {
  description: string;
  usage: string;
  examples: string[];
}

export interface CommandCatalogEntry extends CommandHelpEntry {
  name: string;
  completion: CommandCompletionSpec;
  devOnly?: boolean;
}

export interface CommandAliasEntry {
  alias: string;
  target: string;
}

export const COMMAND_CATALOG: CommandCatalogEntry[] = [
  {
    name: 'help',
    description: 'Show available commands or help for a specific command.',
    usage: 'help [command]',
    examples: ['help', 'help decrypt', 'decrypt --help'],
    completion: { args: 'command' },
  },
  {
    name: 'ls',
    description: 'List directory contents.',
    usage: 'ls [path]',
    examples: ['ls', 'ls /logs', 'ls ..'],
    completion: { args: 'path' },
  },
  {
    name: 'cd',
    description: 'Change the current directory.',
    usage: 'cd <path>',
    examples: ['cd logs', 'cd /systems', 'cd ..', 'cd /'],
    completion: { args: 'path' },
  },
  {
    name: 'pwd',
    description: 'Print the current directory.',
    usage: 'pwd',
    examples: ['pwd'],
    completion: { args: 'none' },
  },
  {
    name: 'cat',
    description: 'Print the contents of a file.',
    usage: 'cat <file>',
    examples: ['cat readme.txt', 'cat /logs/crew_note.txt'],
    completion: { args: 'path' },
  },
  {
    name: 'open',
    description: 'Alias for cat; open and display a file.',
    usage: 'open <file>',
    examples: ['open readme.txt'],
    completion: { args: 'path' },
  },
  {
    name: 'clear',
    description: 'Clear the terminal output.',
    usage: 'clear',
    examples: ['clear'],
    completion: { args: 'none' },
  },
  {
    name: 'status',
    description: 'Show current ship diagnostics.',
    usage: 'status',
    examples: ['status'],
    completion: { args: 'none' },
  },
  {
    name: 'file',
    description: 'Identify a file or directory.',
    usage: 'file <path>',
    examples: ['file readme.txt', 'file /systems/nav_core.dat'],
    completion: { args: 'path' },
  },
  {
    name: 'head',
    description: 'Print the first lines of a file.',
    usage: 'head [-n count] <file>',
    examples: ['head readme.txt', 'head -n 5 /logs/crew_note.txt'],
    completion: { args: 'path', options: [{ name: '-n', requiresValue: true }] },
  },
  {
    name: 'tail',
    description: 'Print the last lines of a file.',
    usage: 'tail [-n count] <file>',
    examples: ['tail readme.txt', 'tail -n 5 /logs/crew_note.txt'],
    completion: { args: 'path', options: [{ name: '-n', requiresValue: true }] },
  },
  {
    name: 'grep',
    description: 'Search for text inside a file.',
    usage: 'grep <pattern> <file>',
    examples: ['grep status readme.txt', 'grep CORE /systems/nav.locked'],
    completion: { args: 'path' },
  },
  {
    name: 'strings',
    description: 'Print printable strings from a file.',
    usage: 'strings <file>',
    examples: ['strings /logs/emergency.enc'],
    completion: { args: 'path' },
  },
  {
    name: 'scan',
    description: 'Scan an unlocked component for repair faults.',
    usage: 'scan <target>',
    examples: ['scan nav_core.dat', 'scan /systems/nav_core.dat'],
    completion: { args: 'path' },
  },
  {
    name: 'analyze',
    description: 'Analyze a file and report encryption details.',
    usage: 'analyze <file>',
    examples: ['analyze emergency.enc', 'analyze /logs/emergency.enc'],
    completion: { args: 'path' },
  },
  {
    name: 'decrypt',
    description: 'Decrypt an encrypted file using the specified cipher method.',
    usage: 'decrypt --method <method> --key <number> <file>',
    examples: [
      'decrypt --method caesar --key <number> emergency.enc',
      'decrypt --method caesar --key <number> /logs/emergency.enc',
    ],
    completion: {
      args: 'path',
      options: [
        { name: '--method', values: ['caesar'], requiresValue: true },
        { name: '--key', requiresValue: true },
      ],
    },
  },
  {
    name: 'auth',
    description: 'Authenticate against a restricted subsystem.',
    usage: 'auth <system> <access-code>',
    examples: ['auth nav <code>'],
    completion: { args: 'none' },
  },
  {
    name: 'repair',
    description: 'Repair an unlocked damaged system component.',
    usage: 'repair <target>',
    examples: ['repair nav_core.dat', 'repair /systems/nav_core.dat'],
    completion: { args: 'path' },
  },
  {
    name: 'dev-fx',
    description: 'Trigger terminal instability for renderer testing.',
    usage: 'dev-fx [seconds] [intensity]',
    examples: ['dev-fx', 'dev-fx 15 0.8'],
    completion: { args: 'none' },
    devOnly: true,
  },
  {
    name: 'dev-speed',
    description: 'Set the mission timer speed multiplier for testing.',
    usage: 'dev-speed <multiplier>',
    examples: ['dev-speed 8', 'dev-speed 1'],
    completion: { args: 'none' },
    devOnly: true,
  },
];

export function getVisibleCommandCatalog(): CommandCatalogEntry[] {
  return COMMAND_CATALOG.filter(command => !command.devOnly);
}

export const COMMAND_ALIASES: CommandAliasEntry[] = [
  { alias: 'dir', target: 'ls' },
  { alias: 'type', target: 'cat' },
  { alias: 'more', target: 'cat' },
  { alias: 'unlock', target: 'auth' },
];

export function getCommandHelp(name: string): CommandHelpEntry | null {
  const entry = COMMAND_CATALOG.find(command => command.name === name);
  if (!entry || entry.devOnly) return null;
  return {
    description: entry.description,
    usage: entry.usage,
    examples: entry.examples,
  };
}
