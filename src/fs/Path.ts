/** Normalize an absolute path, resolving . and .. segments. */
export function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return '/' + resolved.join('/');
}

/**
 * Resolve `input` relative to `cwd`.
 * If `input` starts with '/', it is treated as absolute.
 */
export function resolvePath(cwd: string, input: string): string {
  if (input.startsWith('/')) return normalizePath(input);
  return normalizePath(cwd + '/' + input);
}

/** Return the last segment of an absolute path (the "filename"). */
export function basename(path: string): string {
  const segs = path.split('/').filter(Boolean);
  return segs[segs.length - 1] ?? '/';
}

/** Return the directory part of an absolute path. */
export function dirname(path: string): string {
  const segs = path.split('/').filter(Boolean);
  segs.pop();
  return '/' + segs.join('/');
}
