import type { GameState } from '../game/GameState.ts';
import type { VirtualFileSystem } from '../fs/VirtualFileSystem.ts';
import type { CommandRegistry } from './CommandRegistry.ts';
import { resolvePath } from '../fs/Path.ts';

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

export class Autocomplete {
  /**
   * Attempt to complete `input` based on available commands and VFS paths.
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
  ): { completed: string } | { candidates: string[] } | null {
    const tokens = input.trimStart().split(' ');

    // Complete the command name when only one token is typed.
    if (tokens.length === 1) {
      return this.completeCommand(tokens[0], registry);
    }

    // Complete a path argument (last token).
    const partial = tokens[tokens.length - 1];
    const result = this.completePath(partial, state.currentPath, vfs);
    if (!result) return null;

    if ('candidates' in result) return result;

    // Rebuild the full input with the completed last token.
    tokens[tokens.length - 1] = result.completed;
    return { completed: tokens.join(' ') };
  }

  private completeCommand(
    prefix: string,
    registry: CommandRegistry,
  ): { completed: string } | { candidates: string[] } | null {
    const names = registry.getCommandNames().filter(n => n.startsWith(prefix));
    if (names.length === 0) return null;
    if (names.length === 1) return { completed: names[0] };
    const cp = commonPrefix(names);
    if (cp.length > prefix.length) return { completed: cp };
    return { candidates: names };
  }

  private completePath(
    partial: string,
    cwd: string,
    vfs: VirtualFileSystem,
  ): { completed: string } | { candidates: string[] } | null {
    let searchDir: string;
    let namePrefix: string;

    if (partial.includes('/')) {
      // Split into directory part and name prefix.
      const lastSlash = partial.lastIndexOf('/');
      const dirPart = partial.slice(0, lastSlash + 1); // includes trailing /
      namePrefix = partial.slice(lastSlash + 1);
      searchDir = resolvePath(cwd, dirPart);
    } else {
      searchDir = cwd;
      namePrefix = partial;
    }

    const matches = vfs.listWithPrefix(searchDir, namePrefix);
    if (matches.length === 0) return null;

    if (matches.length === 1) {
      const name = matches[0];
      const fullPath = resolvePath(searchDir, name);
      const suffix = vfs.isDir(fullPath) ? '/' : '';
      // Rebuild the partial path with the completed name.
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

    return { candidates: matches };
  }
}
