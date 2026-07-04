import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const RESOURCE_ROOT = path.resolve('src/resources/filesystem');
const HEADER_SUFFIX = '.header';
const VALID_STATE_FLAGS = new Set([
  'emergencyDecrypted',
  'navUnlocked',
  'navScanned',
  'navRepaired',
]);
const VALID_HEADER_FIELDS = new Set([
  'hidden',
  'accessFlag',
  'accessDenied',
  'repairFlag',
  'repairRequiresFlag',
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

const issues = [];
const files = await collectFiles(RESOURCE_ROOT);
const resourcePaths = new Set(files.map(toResourcePath));
const headers = [];

for (const file of files) {
  const resourcePath = toResourcePath(file);
  if (!resourcePath.endsWith(HEADER_SUFFIX)) continue;

  const targetPath = resourcePath.slice(0, -HEADER_SUFFIX.length);
  if (!resourcePaths.has(targetPath)) {
    issues.push(`${resourcePath}: header file has no target resource`);
  }

  const content = await readFile(file, 'utf8');
  const header = parseHeader(resourcePath, content, issues);
  headers.push({ path: targetPath, header });
}

validateHeaders(headers, issues);

if (issues.length > 0) {
  console.error('Resource validation failed:');
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`Resource validation passed (${files.length} files, ${headers.length} headers).`);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function toResourcePath(file) {
  return path.relative(RESOURCE_ROOT, file).replaceAll(path.sep, '/');
}

function parseHeader(headerPath, content, issueList) {
  const header = {};

  content.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      issueList.push(`${headerPath}: line ${index + 1}: expected 'key: value'`);
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!VALID_HEADER_FIELDS.has(key)) {
      issueList.push(`${headerPath}: unknown field '${key}'`);
      return;
    }

    if (key === 'hidden' || key === 'repairComplete') {
      if (value !== 'true' && value !== 'false') {
        issueList.push(`${headerPath}: invalid ${key} value '${value}', expected true or false`);
      }
      header[key] = value === 'true';
    } else if (key.endsWith('Flag')) {
      if (!VALID_STATE_FLAGS.has(value)) {
        issueList.push(`${headerPath}: invalid ${key} value '${value}'`);
      }
      header[key] = value;
    } else if (key === 'cipher') {
      if (value !== 'caesar') issueList.push(`${headerPath}: invalid cipher '${value}'`);
      header[key] = value;
    } else if (key === 'key') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) issueList.push(`${headerPath}: invalid key '${value}'`);
      header[key] = parsed;
    } else {
      header[key] = value;
    }
  });

  return header;
}

function validateHeaders(headers, issueList) {
  const repairAliases = new Map();
  const puzzleIds = new Map();

  for (const { path: targetPath, header } of headers) {
    if (header.repairAlias) {
      const existing = repairAliases.get(header.repairAlias);
      if (existing) {
        issueList.push(`${targetPath}: duplicate repairAlias '${header.repairAlias}' already used by ${existing}`);
      } else {
        repairAliases.set(header.repairAlias, targetPath);
      }
    }

    if (header.repairComplete && !header.repairFlag) {
      issueList.push(`${targetPath}: repairComplete requires repairFlag`);
    }
    if (header.repairRequiresFlag && !header.repairFlag) {
      issueList.push(`${targetPath}: repairRequiresFlag requires repairFlag`);
    }
    if (header.scanMessage && !header.scanFlag) {
      issueList.push(`${targetPath}: scanMessage requires scanFlag`);
    }

    if (header.puzzleId) {
      const existing = puzzleIds.get(header.puzzleId);
      if (existing) {
        issueList.push(`${targetPath}: duplicate puzzleId '${header.puzzleId}' already used by ${existing}`);
      } else {
        puzzleIds.set(header.puzzleId, targetPath);
      }

      for (const required of ['cipher', 'key', 'answerCode', 'solveFlag']) {
        if (header[required] === undefined || header[required] === '') {
          issueList.push(`${targetPath}: puzzleId requires ${required}`);
        }
      }
    }

    if (!header.puzzleId && (header.cipher || header.key !== undefined || header.answerCode || header.solveFlag)) {
      issueList.push(`${targetPath}: puzzle fields require puzzleId`);
    }
  }
}
