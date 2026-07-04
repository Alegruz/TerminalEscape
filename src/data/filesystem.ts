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

export type FSStateFlag = 'navUnlocked' | 'navRepaired';

export type FSFileHeader = {
  hidden?: boolean;
  accessFlag?: FSStateFlag;
  accessDenied?: string;
  repairFlag?: FSStateFlag;
  repairAlias?: string;
  repairDenied?: string;
  repairComplete?: boolean;
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

function parseHeader(content: string): FSFileHeader {
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
    } else if (key === 'accessFlag' && isStateFlag(value)) {
      header.accessFlag = value;
    } else if (key === 'accessDenied') {
      header.accessDenied = value;
    } else if (key === 'repairFlag' && isStateFlag(value)) {
      header.repairFlag = value;
    } else if (key === 'repairAlias') {
      header.repairAlias = value;
    } else if (key === 'repairDenied') {
      header.repairDenied = value;
    } else if (key === 'repairComplete') {
      header.repairComplete = value === 'true';
    }
  }

  return header;
}

function isStateFlag(value: string): value is FSStateFlag {
  return value === 'navUnlocked' || value === 'navRepaired';
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

  targetFile.header = parseHeader(content);
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

  return root;
}

export const ROOT_FS: FSDir = buildRootFs(resourceFiles);
