import type { FSDir, FSFile, FSFileHeader, FSStateFlag } from './filesystem.ts';

export interface ResourceValidationIssue {
  path: string;
  message: string;
}

export interface ResourceHeaderParseResult {
  header: FSFileHeader;
  issues: ResourceValidationIssue[];
}

const VALID_HEADER_FIELDS = new Set([
  'hidden',
  'accessFlag',
  'accessDenied',
  'repairFlag',
  'repairRequiresFlag',
  'repairRequiresFile',
  'repairPatchSignature',
  'repairAlias',
  'repairDenied',
  'repairComplete',
  'scanFlag',
  'scanMessage',
  'puzzleId',
  'cipher',
  'key',
  'answerCode',
  'solveFlag',
]);

export function parseResourceHeader(path: string, content: string): ResourceHeaderParseResult {
  const header: FSFileHeader = {};
  const issues: ResourceValidationIssue[] = [];

  for (const [index, rawLine] of content.split('\n').entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      issues.push({ path, message: `Line ${index + 1}: expected 'key: value'` });
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!VALID_HEADER_FIELDS.has(key)) {
      issues.push({ path, message: `Unknown header field '${key}'` });
      continue;
    }

    applyHeaderField(path, key, value, header, issues);
  }

  return { header, issues };
}

export function validateResourceTree(root: FSDir): ResourceValidationIssue[] {
  const issues: ResourceValidationIssue[] = [];
  const repairAliases = new Map<string, string>();
  const puzzleIds = new Map<string, string>();

  walkFiles(root, '/', (path, file) => {
    const header = file.header;
    if (!header) return;

    if (header.repairAlias) {
      const existingPath = repairAliases.get(header.repairAlias);
      if (existingPath) {
        issues.push({
          path,
          message: `Duplicate repairAlias '${header.repairAlias}' already used by ${existingPath}`,
        });
      } else {
        repairAliases.set(header.repairAlias, path);
      }
    }

    if (header.repairComplete && !header.repairFlag) {
      issues.push({ path, message: 'repairComplete requires repairFlag' });
    }
    if (header.repairRequiresFlag && !header.repairFlag) {
      issues.push({ path, message: 'repairRequiresFlag requires repairFlag' });
    }
    if (header.repairRequiresFile && !header.repairFlag) {
      issues.push({ path, message: 'repairRequiresFile requires repairFlag' });
    } else if (header.repairRequiresFile && !findFile(root, header.repairRequiresFile)) {
      issues.push({ path, message: `repairRequiresFile target not found: ${header.repairRequiresFile}` });
    }
    if (header.repairPatchSignature && !header.repairRequiresFile) {
      issues.push({ path, message: 'repairPatchSignature requires repairRequiresFile' });
    }
    if (header.scanMessage && !header.scanFlag) {
      issues.push({ path, message: 'scanMessage requires scanFlag' });
    }

    if (header.puzzleId) {
      const existingPath = puzzleIds.get(header.puzzleId);
      if (existingPath) {
        issues.push({
          path,
          message: `Duplicate puzzleId '${header.puzzleId}' already used by ${existingPath}`,
        });
      } else {
        puzzleIds.set(header.puzzleId, path);
      }

      if (!header.cipher) issues.push({ path, message: 'puzzleId requires cipher' });
      if (header.key === undefined) issues.push({ path, message: 'puzzleId requires key' });
      if (!header.answerCode) issues.push({ path, message: 'puzzleId requires answerCode' });
      if (!header.solveFlag) issues.push({ path, message: 'puzzleId requires solveFlag' });
    }

    if (!header.puzzleId && (header.cipher || header.key !== undefined || header.answerCode || header.solveFlag)) {
      issues.push({ path, message: 'Puzzle fields require puzzleId' });
    }
  });

  return issues;
}

function findFile(root: FSDir, absolutePath: string): FSFile | null {
  const parts = absolutePath.split('/').filter(Boolean);
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

export function assertNoResourceIssues(issues: ResourceValidationIssue[]): void {
  if (issues.length === 0) return;
  const details = issues.map(issue => `${issue.path}: ${issue.message}`).join('\n');
  throw new Error(`Resource validation failed:\n${details}`);
}

export function isStateFlag(value: string): value is FSStateFlag {
  return value === 'emergencyDecrypted' ||
    value === 'navUnlocked' ||
    value === 'navScanned' ||
    value === 'navRepaired';
}

function applyHeaderField(
  path: string,
  key: string,
  value: string,
  header: FSFileHeader,
  issues: ResourceValidationIssue[],
): void {
  if (key === 'hidden') {
    header.hidden = parseBoolean(path, key, value, issues);
  } else if (key === 'accessFlag') {
    header.accessFlag = parseStateFlag(path, key, value, issues);
  } else if (key === 'accessDenied') {
    header.accessDenied = value;
  } else if (key === 'repairFlag') {
    header.repairFlag = parseStateFlag(path, key, value, issues);
  } else if (key === 'repairRequiresFlag') {
    header.repairRequiresFlag = parseStateFlag(path, key, value, issues);
  } else if (key === 'repairRequiresFile') {
    header.repairRequiresFile = value;
  } else if (key === 'repairPatchSignature') {
    header.repairPatchSignature = value;
  } else if (key === 'repairAlias') {
    header.repairAlias = value;
  } else if (key === 'repairDenied') {
    header.repairDenied = value;
  } else if (key === 'repairComplete') {
    header.repairComplete = parseBoolean(path, key, value, issues);
  } else if (key === 'scanFlag') {
    header.scanFlag = parseStateFlag(path, key, value, issues);
  } else if (key === 'scanMessage') {
    header.scanMessage = value;
  } else if (key === 'puzzleId') {
    header.puzzleId = value;
  } else if (key === 'cipher') {
    if (value === 'caesar') {
      header.cipher = value;
    } else {
      issues.push({ path, message: `Invalid cipher '${value}'` });
    }
  } else if (key === 'key') {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      header.key = parsed;
    } else {
      issues.push({ path, message: `Invalid key '${value}'` });
    }
  } else if (key === 'answerCode') {
    header.answerCode = value;
  } else if (key === 'solveFlag') {
    header.solveFlag = parseStateFlag(path, key, value, issues);
  }
}

function parseBoolean(
  path: string,
  key: string,
  value: string,
  issues: ResourceValidationIssue[],
): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  issues.push({ path, message: `Invalid ${key} value '${value}', expected true or false` });
  return false;
}

function parseStateFlag(
  path: string,
  key: string,
  value: string,
  issues: ResourceValidationIssue[],
): FSStateFlag | undefined {
  if (isStateFlag(value)) return value;
  issues.push({ path, message: `Invalid ${key} value '${value}'` });
  return undefined;
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
