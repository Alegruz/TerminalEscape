export type FSFile = {
  type: 'file';
  content: string;
  header?: FSFileHeader;
};

export type FSDir = {
  type: 'dir';
  children: Record<string, FSFile | FSDir>;
};

export type FSNode = FSFile | FSDir;

export type FSStateFlag = 'emergencyDecrypted' | 'navUnlocked' | 'navScanned' | 'navRepaired';

export type FSFileHeader = {
  hidden?: boolean;
  accessFlag?: FSStateFlag;
  accessDenied?: string;
  repairFlag?: FSStateFlag;
  repairRequiresFlag?: FSStateFlag;
  repairAlias?: string;
  repairDenied?: string;
  repairComplete?: boolean;
  scanFlag?: FSStateFlag;
  scanMessage?: string;
  puzzleId?: string;
  cipher?: 'caesar';
  key?: number;
  answerCode?: string;
  solveFlag?: FSStateFlag;
};

const RESOURCE_ROOT = '../resources/filesystem/';
const HEADER_SUFFIX = '.header';

const resourceFiles = import.meta.glob<string>('../resources/filesystem/**/*', {
  eager: true,
  import: 'default',
  query: '?raw',
});

function createDir(): FSDir {
  return {
    type: 'dir',
    children: {},
  };
}

function getOrCreateDir(parent: FSDir, name: string): FSDir {
  const existing = parent.children[name];

  if (existing?.type === 'dir') return existing;
  if (existing?.type === 'file') {
    throw new Error(`Resource path conflict: ${name} is both a file and directory`);
  }

  const dir = createDir();
  parent.children[name] = dir;
  return dir;
}

function parseHeader(path: string, content: string): FSFileHeader {
  const header: FSFileHeader = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'hidden') {
      header.hidden = value === 'true';
    } else if (key === 'accessFlag') {
      header.accessFlag = parseStateFlag(path, key, value);
    } else if (key === 'accessDenied') {
      header.accessDenied = value;
    } else if (key === 'repairFlag') {
      header.repairFlag = parseStateFlag(path, key, value);
    } else if (key === 'repairRequiresFlag') {
      header.repairRequiresFlag = parseStateFlag(path, key, value);
    } else if (key === 'repairAlias') {
      header.repairAlias = value;
    } else if (key === 'repairDenied') {
      header.repairDenied = value;
    } else if (key === 'repairComplete') {
      header.repairComplete = value === 'true';
    } else if (key === 'scanFlag') {
      header.scanFlag = parseStateFlag(path, key, value);
    } else if (key === 'scanMessage') {
      header.scanMessage = value;
    } else if (key === 'puzzleId') {
      header.puzzleId = value;
    } else if (key === 'cipher' && value === 'caesar') {
      header.cipher = value;
    } else if (key === 'key') {
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed)) throw new Error(`Invalid key in ${path}`);
      header.key = parsed;
    } else if (key === 'answerCode') {
      header.answerCode = value;
    } else if (key === 'solveFlag') {
      header.solveFlag = parseStateFlag(path, key, value);
    } else {
      throw new Error(`Unknown header field '${key}' in ${path}`);
    }
  }

  return header;
}

function isStateFlag(value: string): value is FSStateFlag {
  return value === 'emergencyDecrypted' ||
    value === 'navUnlocked' ||
    value === 'navScanned' ||
    value === 'navRepaired';
}

function parseStateFlag(path: string, key: string, value: string): FSStateFlag {
  if (isStateFlag(value)) return value;
  throw new Error(`Invalid ${key} value '${value}' in ${path}`);
}

function findFile(root: FSDir, path: string): FSFile | null {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;

  let current = root;
  for (const part of parts) {
    const child = current.children[part];
    if (!child || child.type !== 'dir') return null;
    current = child;
  }

  const file = current.children[fileName];
  return file?.type === 'file' ? file : null;
}

function addFile(root: FSDir, path: string, content: string): void {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.pop();

  if (!fileName) return;

  let current = root;
  for (const part of parts) {
    current = getOrCreateDir(current, part);
  }

  current.children[fileName] = {
    type: 'file',
    content,
  };
}

function addHeader(root: FSDir, headerPath: string, content: string): void {
  const targetPath = headerPath.slice(0, -HEADER_SUFFIX.length);
  const targetFile = findFile(root, targetPath);
  if (!targetFile) {
    throw new Error(`Header file has no target resource: ${headerPath}`);
  }

  targetFile.header = parseHeader(headerPath, content);
}

function validateHeaders(root: FSDir): void {
  const repairAliases = new Map<string, string>();
  walkFiles(root, '/', (path, file) => {
    const header = file.header;
    if (!header) return;

    if (header.repairAlias) {
      const existingPath = repairAliases.get(header.repairAlias);
      if (existingPath) {
        throw new Error(`Duplicate repairAlias '${header.repairAlias}' in ${path} and ${existingPath}`);
      }
      repairAliases.set(header.repairAlias, path);
    }

    if (header.repairComplete && !header.repairFlag) {
      throw new Error(`repairComplete requires repairFlag in ${path}`);
    }
    if (header.repairRequiresFlag && !header.repairFlag) {
      throw new Error(`repairRequiresFlag requires repairFlag in ${path}`);
    }
    if (header.puzzleId) {
      if (!header.cipher || header.key === undefined || !header.answerCode || !header.solveFlag) {
        throw new Error(`Puzzle header requires cipher, key, answerCode, and solveFlag in ${path}`);
      }
    }
  });
}

function walkFiles(
  dir: FSDir,
  currentPath: string,
  visit: (path: string, file: FSFile) => void,
): void {
  for (const [name, child] of Object.entries(dir.children)) {
    const childPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    if (child.type === 'file') {
      visit(childPath, child);
    } else {
      walkFiles(child, childPath, visit);
    }
  }
}

function buildRootFs(files: Record<string, string>): FSDir {
  const root = createDir();
  const paths = Object.keys(files).sort();

  for (const modulePath of paths) {
    const resourcePath = modulePath.replace(RESOURCE_ROOT, '');
    if (resourcePath.endsWith(HEADER_SUFFIX)) continue;
    addFile(root, resourcePath, files[modulePath]);
  }

  for (const modulePath of paths) {
    const resourcePath = modulePath.replace(RESOURCE_ROOT, '');
    if (!resourcePath.endsWith(HEADER_SUFFIX)) continue;
    addHeader(root, resourcePath, files[modulePath]);
  }

  validateHeaders(root);

  return root;
}

export const ROOT_FS: FSDir = buildRootFs(resourceFiles);
