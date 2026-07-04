import { ROOT_FS } from '../data/filesystem.ts';
import type { FSNode, FSDir, FSFile, FSFileHeader } from '../data/filesystem.ts';
import { normalizePath, resolvePath } from './Path.ts';

export class VirtualFileSystem {
  private readonly root: FSDir = ROOT_FS;

  // ── Resolution ───────────────────────────────────────────────────────────────

  /** Resolve `input` (relative or absolute) against `cwd`. */
  resolve(cwd: string, input: string): string {
    return resolvePath(cwd, input);
  }

  // ── Node access ──────────────────────────────────────────────────────────────

  getNode(absolutePath: string): FSNode | null {
    const path = normalizePath(absolutePath);
    if (path === '/') return this.root;
    const parts = path.split('/').filter(Boolean);
    let current: FSNode = this.root;
    for (const part of parts) {
      if (current.type !== 'dir') return null;
      const child: FSFile | FSDir | undefined = current.children[part];
      if (child === undefined) return null;
      current = child;
    }
    return current;
  }

  getNodeType(absolutePath: string): 'file' | 'dir' | null {
    return this.getNode(absolutePath)?.type ?? null;
  }

  isDir(absolutePath: string): boolean {
    return this.getNodeType(absolutePath) === 'dir';
  }

  isFile(absolutePath: string): boolean {
    return this.getNodeType(absolutePath) === 'file';
  }

  // ── Operations ───────────────────────────────────────────────────────────────

  listDir(absolutePath: string): string[] | null {
    const node = this.getNode(absolutePath);
    if (!node || node.type !== 'dir') return null;
    return Object.entries(node.children)
      .filter(([, child]) => child.type !== 'file' || child.header?.hidden !== true)
      .map(([name]) => name)
      .sort();
  }

  readFile(absolutePath: string): string | null {
    const node = this.getNode(absolutePath);
    if (!node || node.type !== 'file') return null;
    return (node as FSFile).content;
  }

  getFileHeader(absolutePath: string): FSFileHeader | null {
    const node = this.getNode(absolutePath);
    if (!node || node.type !== 'file') return null;
    return node.header ?? null;
  }

  /** Return all absolute paths that start with `prefix` (for autocomplete). */
  listWithPrefix(absoluteDir: string, namePrefix: string): string[] {
    const names = this.listDir(absoluteDir) ?? [];
    return names.filter(n => n.startsWith(namePrefix));
  }
}
