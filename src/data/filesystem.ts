export type FSFile = {
  type: 'file';
  content: string;
};

export type FSDir = {
  type: 'dir';
  children: Record<string, FSFile | FSDir>;
};

export type FSNode = FSFile | FSDir;

const RESOURCE_ROOT = '../resources/filesystem/';

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

function buildRootFs(files: Record<string, string>): FSDir {
  const root = createDir();
  const paths = Object.keys(files).sort();

  for (const modulePath of paths) {
    const resourcePath = modulePath.replace(RESOURCE_ROOT, '');
    addFile(root, resourcePath, files[modulePath]);
  }

  return root;
}

export const ROOT_FS: FSDir = buildRootFs(resourceFiles);
