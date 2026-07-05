import {
  assertNoResourceIssues,
  parseResourceHeader,
  validateResourceTree,
} from './ResourceValidation.ts';

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

export type FSStateFlag = 'logDecrypted' | 'shutdownStopped';

export type FSFileHeader = {
  hidden?: boolean;
  accessFlag?: FSStateFlag;
  accessDenied?: string;
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

  const result = parseResourceHeader(headerPath, content);
  assertNoResourceIssues(result.issues);
  targetFile.header = result.header;
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

  assertNoResourceIssues(validateResourceTree(root));

  return root;
}

export const ROOT_FS: FSDir = buildRootFs(resourceFiles);
