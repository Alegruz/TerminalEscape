import type { CommandCompletionSpec } from '../terminal/CommandRegistry.ts';
import type { GameState } from '../game/GameState.ts';

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
    description: 'List available recovery console commands.',
    usage: 'help [command]',
    examples: ['help', 'help tiles', 'decrypt --help'],
    completion: { args: 'command' },
  },
  {
    name: 'tiles',
    description: 'Play the bundled BastionOS tile puzzle.',
    usage: 'tiles [tile-number]',
    examples: ['tiles', 'tiles 5', 'tiles 4'],
    completion: { args: 'none' },
  },
  {
    name: 'ls',
    description: 'List directory contents.',
    usage: 'ls [path]',
    examples: ['ls', 'ls /logs', 'ls /art'],
    completion: { args: 'path' },
  },
  {
    name: 'cat',
    description: 'Print the contents of a file.',
    usage: 'cat <file>',
    examples: ['cat readme.txt', 'cat /art/watcher.txt'],
    completion: { args: 'path' },
  },
  {
    name: 'shutdown',
    description: 'Request host shutdown control.',
    usage: 'shutdown --cancel',
    examples: ['shutdown --cancel', 'shutdown now'],
    completion: { args: 'none' },
  },
  {
    name: 'analyze',
    description: 'Analyze a file and report encryption clues.',
    usage: 'analyze <file>',
    examples: ['analyze shutdown.log.enc', 'analyze /logs/shutdown.log.enc'],
    completion: { args: 'path' },
  },
  {
    name: 'decrypt',
    description: 'Decrypt an encrypted log using the specified cipher method.',
    usage: 'decrypt --method <method> --key <number> <file>',
    examples: [
      'decrypt --method caesar --key <number> shutdown.log.enc',
      'decrypt --method caesar --key <number> /logs/shutdown.log.enc',
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
    name: 'sudo',
    description: 'Run the only privileged action the shutdown daemon accepts.',
    usage: 'sudo shutdown (--cancel|--wipe)',
    examples: ['sudo shutdown --cancel', 'sudo shutdown --wipe'],
    completion: {
      args: 'none',
    },
  },
];

function isSuppressed(commandName: string, state?: GameState): boolean {
  return commandName === 'shutdown' &&
    Boolean(state?.flags.shutdownCommandSuppressed) &&
    !Boolean(state?.flags.timerStarted);
}

export function getVisibleCommandCatalog(state?: GameState): CommandCatalogEntry[] {
  return COMMAND_CATALOG.filter(command => !command.devOnly && !isSuppressed(command.name, state));
}

export const COMMAND_ALIASES: CommandAliasEntry[] = [];

export function getCommandHelp(name: string, state?: GameState): CommandHelpEntry | null {
  const entry = COMMAND_CATALOG.find(command => command.name === name);
  if (!entry || entry.devOnly || isSuppressed(entry.name, state)) return null;
  return {
    description: entry.description,
    usage: entry.usage,
    examples: entry.examples,
  };
}
