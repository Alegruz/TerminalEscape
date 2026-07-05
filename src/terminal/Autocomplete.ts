import type { GameState } from '../game/GameState.ts';
import type { VirtualFileSystem } from '../fs/VirtualFileSystem.ts';
import type {
  CommandCompletionSpec,
  CommandOptionSpec,
  CommandRegistry,
} from './CommandRegistry.ts';
import { resolvePath } from '../fs/Path.ts';

type CompletionResult = { completed: string } | { candidates: string[] } | null;

const GLOBAL_OPTIONS: CommandOptionSpec[] = [
  { name: '--help' },
  { name: '-h' },
];

interface InputToken {
  value: string;
  start: number;
  end: number;
}

/** Return the longest common prefix of an array of strings. */
function commonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }
  return prefix;
}

function tokenizeInput(input: string): InputToken[] {
  const tokens: InputToken[] = [];
  const matches = input.matchAll(/\S+/g);

  for (const match of matches) {
    const value = match[0];
    const start = match.index ?? 0;
    tokens.push({ value, start, end: start + value.length });
  }

  if (/\s$/.test(input)) {
    tokens.push({ value: '', start: input.length, end: input.length });
  }

  return tokens;
}

function replaceToken(input: string, token: InputToken, value: string): string {
  return input.slice(0, token.start) + value + input.slice(token.end);
}

function appendSpace(value: string): string {
  return value.endsWith(' ') ? value : `${value} `;
}

export class Autocomplete {
  /**
   * Attempt to complete `input` based on command metadata and the VFS.
   *
   * Returns:
   *   { completed: string }         — a full or partial completion to replace input
   *   { candidates: string[] }      — multiple matches (caller may display them)
   *   null                          — no match found
   */
  complete(
    input: string,
    state: GameState,
    vfs: VirtualFileSystem,
    registry: CommandRegistry,
  ): CompletionResult {
    const tokens = tokenizeInput(input);
    const current = tokens[tokens.length - 1] ?? { value: '', start: 0, end: 0 };

    if (tokens.length <= 1) {
      return this.completeCommand(input, current, registry, state);
    }

    const commandName = registry.resolveName(tokens[0].value.toLowerCase());
    if (!registry.hasCommand(commandName) || this.isCommandSuppressed(commandName, state)) return null;

    if (commandName === 'sudo') {
      return this.completeSudoShutdown(input, current, tokens);
    }

    const spec = registry.getCompletionSpec(commandName);
    const optionValue = this.findOptionAwaitingValue(tokens, current, spec);
    if (optionValue) {
      return this.completeOptionValue(input, current, optionValue, state, vfs);
    }

    if (current.value.startsWith('-')) {
      return this.completeOption(input, current, tokens, spec);
    }

    if (spec.args === 'command') {
      return this.completeCommand(input, current, registry, state);
    }

    if (spec.args === 'path') {
      return this.completePathToken(input, current, state.currentPath, vfs);
    }

    return null;
  }

  private completeCommand(
    input: string,
    token: InputToken,
    registry: CommandRegistry,
    state: GameState,
  ): CompletionResult {
    const prefix = token.value.toLowerCase();
    const names = registry.getCommandNames()
      .filter(name => !this.isCommandSuppressed(name, state))
      .filter(n => n.startsWith(prefix));
    const result = this.completeFromCandidates(prefix, names, true);
    if (!result || 'candidates' in result) return result;
    return { completed: replaceToken(input, token, result.completed) };
  }

  private completeSudoShutdown(
    input: string,
    token: InputToken,
    tokens: InputToken[],
  ): CompletionResult {
    if (tokens.length === 2) {
      const result = this.completeFromCandidates(token.value.toLowerCase(), ['shutdown'], true);
      if (!result || 'candidates' in result) return result;
      return { completed: replaceToken(input, token, result.completed) };
    }

    if (tokens.length === 3 && tokens[1].value.toLowerCase() === 'shutdown') {
      const result = this.completeFromCandidates(token.value.toLowerCase(), ['--cancel', '--wipe'], true);
      if (!result || 'candidates' in result) return result;
      return { completed: replaceToken(input, token, result.completed) };
    }

    return null;
  }

  private isCommandSuppressed(commandName: string, state: GameState): boolean {
    return commandName === 'shutdown' &&
      state.flags.shutdownCommandSuppressed &&
      !state.flags.timerStarted;
  }

  private completeOption(
    input: string,
    token: InputToken,
    tokens: InputToken[],
    spec: CommandCompletionSpec,
  ): CompletionResult {
    const options = [...(spec.options ?? []), ...GLOBAL_OPTIONS];
    const used = new Set(tokens.slice(1, -1).map(t => t.value));
    const matches = options
      .filter(option => !used.has(option.name))
      .map(option => option.name)
      .filter(name => name.startsWith(token.value));

    const result = this.completeFromCandidates(token.value, matches, true);
    if (!result || 'candidates' in result) return result;
    return { completed: replaceToken(input, token, result.completed) };
  }

  private findOptionAwaitingValue(
    tokens: InputToken[],
    current: InputToken,
    spec: CommandCompletionSpec,
  ): CommandOptionSpec | null {
    const options = spec.options ?? [];
    if (tokens.length < 3) return null;

    const previous = tokens[tokens.length - 2];
    if (!previous || previous === current) return null;

    const option = options.find(candidate => candidate.name === previous.value);
    if (!option?.requiresValue) return null;

    return option;
  }

  private completeOptionValue(
    input: string,
    token: InputToken,
    option: CommandOptionSpec,
    state: GameState,
    vfs: VirtualFileSystem,
  ): CompletionResult {
    if (option.valueCompletion === 'path') {
      return this.completePathToken(input, token, state.currentPath, vfs);
    }

    const values = option.values ?? [];
    if (values.length === 0) return null;

    const result = this.completeFromCandidates(token.value, values, true);
    if (!result || 'candidates' in result) return result;
    return { completed: replaceToken(input, token, result.completed) };
  }

  private completePathToken(
    input: string,
    token: InputToken,
    cwd: string,
    vfs: VirtualFileSystem,
  ): CompletionResult {
    const result = this.completePath(token.value, cwd, vfs);
    if (!result) return null;
    if ('candidates' in result) return result;
    return { completed: replaceToken(input, token, result.completed) };
  }

  private completeFromCandidates(
    prefix: string,
    candidates: string[],
    addSpaceOnSingle: boolean,
  ): { completed: string } | { candidates: string[] } | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) {
      const completed = addSpaceOnSingle ? appendSpace(candidates[0]) : candidates[0];
      return { completed };
    }

    const cp = commonPrefix(candidates);
    if (cp.length > prefix.length) return { completed: cp };

    return { candidates };
  }

  private completePath(
    partial: string,
    cwd: string,
    vfs: VirtualFileSystem,
  ): { completed: string } | { candidates: string[] } | null {
    let searchDir: string;
    let namePrefix: string;

    if (partial.includes('/')) {
      const lastSlash = partial.lastIndexOf('/');
      const dirPart = partial.slice(0, lastSlash + 1);
      namePrefix = partial.slice(lastSlash + 1);
      searchDir = resolvePath(cwd, dirPart);
    } else {
      searchDir = cwd;
      namePrefix = partial;
    }

    const matches = vfs.listWithPrefix(searchDir, namePrefix);
    if (matches.length === 0) return null;

    const displayMatches = matches.map(name => {
      const fullPath = resolvePath(searchDir, name);
      return vfs.isDir(fullPath) ? `${name}/` : name;
    });

    if (matches.length === 1) {
      const name = matches[0];
      const fullPath = resolvePath(searchDir, name);
      const suffix = vfs.isDir(fullPath) ? '/' : ' ';
      const completedPartial = partial.includes('/')
        ? partial.slice(0, partial.lastIndexOf('/') + 1) + name + suffix
        : name + suffix;
      return { completed: completedPartial };
    }

    const cp = commonPrefix(matches);
    if (cp.length > namePrefix.length) {
      const completedPartial = partial.includes('/')
        ? partial.slice(0, partial.lastIndexOf('/') + 1) + cp
        : cp;
      return { completed: completedPartial };
    }

    return { candidates: displayMatches };
  }
}
