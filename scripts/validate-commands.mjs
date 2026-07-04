import { readFile } from 'node:fs/promises';
import process from 'node:process';

const CATALOG_PATH = 'src/commands/CommandCatalog.ts';
const MANIFEST_PATH = 'src/commands/CommandManifest.ts';
const COMMAND_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const VALID_COMPLETION_ARGS = new Set(['none', 'path', 'command']);

const issues = [];
const catalogSource = await readFile(CATALOG_PATH, 'utf8');
const manifestSource = await readFile(MANIFEST_PATH, 'utf8');

const catalogEntries = parseCatalogEntries(catalogSource);
const aliases = parseAliases(catalogSource);
const handlers = parseHandlers(manifestSource);

validateCatalog(catalogEntries, handlers, issues);
validateAliases(aliases, catalogEntries, issues);

if (issues.length > 0) {
  console.error('Command validation failed:');
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(
  `Command validation passed (${catalogEntries.length} commands, ${aliases.length} aliases).`,
);

function parseCatalogEntries(source) {
  const block = extractArrayBlock(source, 'COMMAND_CATALOG');
  return extractTopLevelObjects(block).map(objectSource => ({
    source: objectSource,
    name: matchStringField(objectSource, 'name'),
    description: matchStringField(objectSource, 'description'),
    usage: matchStringField(objectSource, 'usage'),
    examples: matchArrayField(objectSource, 'examples'),
    completionArgs: matchCompletionArgs(objectSource),
    optionNames: [...objectSource.matchAll(/name:\s*['"]([^'"]+)['"]/g)]
      .map(match => match[1])
      .filter(name => name.startsWith('-')),
  }));
}

function parseAliases(source) {
  const block = extractArrayBlock(source, 'COMMAND_ALIASES');
  return extractTopLevelObjects(block).map(objectSource => ({
    source: objectSource,
    alias: matchStringField(objectSource, 'alias'),
    target: matchStringField(objectSource, 'target'),
  }));
}

function parseHandlers(source) {
  const block = extractObjectBlock(source, 'HANDLERS');
  return [...block.matchAll(/^\s*([a-z][a-z0-9-]*)\s*:/gm)].map(match => match[1]);
}

function validateCatalog(entries, handlers, issueList) {
  const names = new Set();
  const handlerNames = new Set(handlers);

  for (const entry of entries) {
    const label = entry.name ?? '<missing name>';

    if (!entry.name) {
      issueList.push('Catalog entry is missing name');
      continue;
    }
    if (names.has(entry.name)) {
      issueList.push(`Duplicate command '${entry.name}'`);
    }
    names.add(entry.name);

    if (!COMMAND_NAME_PATTERN.test(entry.name)) {
      issueList.push(`Command '${entry.name}' must use lowercase shell-safe naming`);
    }
    if (!entry.description?.trim()) {
      issueList.push(`Command '${label}' is missing description`);
    }
    if (!entry.usage?.trim()) {
      issueList.push(`Command '${label}' is missing usage`);
    }
    if (entry.examples.length === 0 || entry.examples.some(example => !example.trim())) {
      issueList.push(`Command '${label}' must provide at least one example`);
    }
    if (!entry.completionArgs) {
      issueList.push(`Command '${label}' is missing completion.args`);
    } else if (!VALID_COMPLETION_ARGS.has(entry.completionArgs)) {
      issueList.push(`Command '${label}' uses invalid completion args '${entry.completionArgs}'`);
    }
    if (!handlerNames.has(entry.name)) {
      issueList.push(`Command '${entry.name}' is missing a handler in CommandManifest.ts`);
    }
    if (entry.optionNames.includes('--help') || entry.optionNames.includes('-h')) {
      issueList.push(`Command '${entry.name}' must not declare --help/-h; registry provides it globally`);
    }
  }

  for (const handlerName of handlerNames) {
    if (!names.has(handlerName)) {
      issueList.push(`Handler '${handlerName}' has no COMMAND_CATALOG entry`);
    }
  }

  if (!names.has('help')) {
    issueList.push("Command catalog must include 'help'");
  }
}

function validateAliases(aliases, catalogEntries, issueList) {
  const commandNames = new Set(catalogEntries.map(entry => entry.name).filter(Boolean));
  const aliasNames = new Set();

  for (const alias of aliases) {
    const label = alias.alias ?? '<missing alias>';
    if (!alias.alias) {
      issueList.push('Alias entry is missing alias');
      continue;
    }
    if (aliasNames.has(alias.alias)) {
      issueList.push(`Duplicate alias '${alias.alias}'`);
    }
    aliasNames.add(alias.alias);

    if (!COMMAND_NAME_PATTERN.test(alias.alias)) {
      issueList.push(`Alias '${alias.alias}' must use lowercase shell-safe naming`);
    }
    if (commandNames.has(alias.alias)) {
      issueList.push(`Alias '${alias.alias}' conflicts with a command name`);
    }
    if (!alias.target) {
      issueList.push(`Alias '${label}' is missing target`);
    } else if (!commandNames.has(alias.target)) {
      issueList.push(`Alias '${label}' targets unknown command '${alias.target}'`);
    }
  }
}

function extractArrayBlock(source, exportName) {
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find ${exportName}`);
  const assignment = source.indexOf('=', start);
  if (assignment === -1) throw new Error(`Could not find ${exportName} assignment`);
  const arrayStart = source.indexOf('[', assignment);
  if (arrayStart === -1) throw new Error(`Could not find ${exportName} array`);
  return readBalanced(source, arrayStart, '[', ']');
}

function extractObjectBlock(source, constName) {
  const marker = `const ${constName}`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find ${constName}`);
  const objectStart = source.indexOf('{', start);
  if (objectStart === -1) throw new Error(`Could not find ${constName} object`);
  return readBalanced(source, objectStart, '{', '}');
}

function extractTopLevelObjects(block) {
  const objects = [];
  let i = 0;
  while (i < block.length) {
    if (block[i] === '{') {
      const objectBlock = readBalanced(block, i, '{', '}');
      objects.push(objectBlock);
      i += objectBlock.length;
    } else {
      i++;
    }
  }
  return objects;
}

function readBalanced(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }

  throw new Error(`Unbalanced ${open}${close} block`);
}

function matchStringField(source, fieldName) {
  return source.match(new RegExp(`${fieldName}:\\s*['"]([^'"]*)['"]`))?.[1] ?? null;
}

function matchArrayField(source, fieldName) {
  const match = source.match(new RegExp(`${fieldName}:\\s*\\[([^\\]]*)\\]`, 's'));
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]*)['"]/g)].map(item => item[1]);
}

function matchCompletionArgs(source) {
  const completion = source.match(/completion:\s*\{([\s\S]*)\}\s*,?\s*$/)?.[1];
  if (!completion) return null;
  return completion.match(/args:\s*['"]([^'"]+)['"]/)?.[1] ?? null;
}
