import type { GameState } from '../game/GameState.ts';
import type { VirtualFileSystem } from './VirtualFileSystem.ts';

export interface AccessResult {
  allowed: boolean;
  reason: string;
}

export function checkFileAccess(
  state: GameState,
  vfs: VirtualFileSystem,
  absolutePath: string,
): AccessResult {
  const header = vfs.getFileHeader(absolutePath);
  if (!header?.accessFlag || state.flags[header.accessFlag]) {
    return { allowed: true, reason: '' };
  }

  return {
    allowed: false,
    reason: header.accessDenied ?? 'authorization required',
  };
}
