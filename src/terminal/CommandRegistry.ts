import type { TextColor } from '../style/theme.ts';
import type { GameState } from '../game/GameState.ts';
import type { VirtualFileSystem } from '../fs/VirtualFileSystem.ts';
import type { PuzzleRegistry } from '../puzzles/PuzzleRegistry.ts';
import type { TerminalBuffer } from './TerminalBuffer.ts';
import type { ParsedCommand } from './CommandParser.ts';

export interface OutputLine {
  text: string;
  color: TextColor;
}

/** Helper to create a single OutputLine. */
export function out(text: string, color: TextColor = 'normal'): OutputLine {
  return { text, color };
}

export interface CommandContext {
  state: GameState;
  vfs: VirtualFileSystem;
  puzzles: PuzzleRegistry;
  buffer: TerminalBuffer;
}

export type CommandHandler = (
  cmd: ParsedCommand,
  ctx: CommandContext,
) => OutputLine[];

export interface CommandOptionSpec {
  name: string;
  values?: string[];
  requiresValue?: boolean;
}

export interface CommandCompletionSpec {
  args?: 'none' | 'path' | 'command';
  options?: CommandOptionSpec[];
}

export class CommandRegistry {
  private readonly commands = new Map<string, CommandHandler>();
  private readonly completions = new Map<string, CommandCompletionSpec>();
  private readonly aliases = new Map<string, string>();
  private readonly hiddenCommands = new Set<string>();

  register(
    name: string,
    handler: CommandHandler,
    completion: CommandCompletionSpec = {},
    options: { hidden?: boolean } = {},
  ): void {
    this.commands.set(name, handler);
    this.completions.set(name, completion);
    if (options.hidden) {
      this.hiddenCommands.add(name);
    } else {
      this.hiddenCommands.delete(name);
    }
  }

  alias(aliasName: string, targetName: string): void {
    this.aliases.set(aliasName, targetName);
  }

  /**
   * Execute a parsed command.
   * Intercepts --help / -h flags to delegate to the help command.
   */
  execute(cmd: ParsedCommand, ctx: CommandContext): OutputLine[] {
    const resolved = this.aliases.get(cmd.name) ?? cmd.name;

    // Generic --help / -h redirection.
    if (cmd.flags['help'] === true || cmd.flags['h'] === true) {
      const helpHandler = this.commands.get('help');
      if (helpHandler) {
        const helpCmd: ParsedCommand = {
          name: 'help',
          args: [resolved],
          flags: {},
          raw: `help ${resolved}`,
        };
        return helpHandler(helpCmd, ctx);
      }
    }

    const handler = this.commands.get(resolved);
    if (!handler) {
      return [
        out(
          `bash: ${cmd.name}: command not found.  Type 'help' for available commands.`,
          'error',
        ),
      ];
    }
    return handler(cmd, ctx);
  }

  getCommandNames(): string[] {
    return [...this.commands.keys()]
      .filter(name => !this.hiddenCommands.has(name))
      .sort();
  }

  resolveName(name: string): string {
    return this.aliases.get(name) ?? name;
  }

  getCompletionSpec(name: string): CommandCompletionSpec {
    return this.completions.get(this.resolveName(name)) ?? {};
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }
}
