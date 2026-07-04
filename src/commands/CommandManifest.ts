import type { CommandHandler, CommandRegistry } from '../terminal/CommandRegistry.ts';
import { COMMAND_ALIASES, COMMAND_CATALOG } from './CommandCatalog.ts';
import { helpCommand } from './help.ts';
import { lsCommand } from './ls.ts';
import { cdCommand } from './cd.ts';
import { pwdCommand } from './pwd.ts';
import { catCommand } from './cat.ts';
import { clearCommand } from './clear.ts';
import { statusCommand } from './status.ts';
import { analyzeCommand } from './analyze.ts';
import { decryptCommand } from './decrypt.ts';
import { authCommand } from './auth.ts';
import { repairCommand } from './repair.ts';
import { fileCommand } from './file.ts';
import { headCommand, tailCommand } from './head.ts';
import { grepCommand } from './grep.ts';
import { stringsCommand } from './strings.ts';
import { scanCommand } from './scan.ts';
import { devFxCommand, devSpeedCommand } from './dev.ts';

const HANDLERS: Record<string, CommandHandler> = {
  help: helpCommand,
  ls: lsCommand,
  cd: cdCommand,
  pwd: pwdCommand,
  cat: catCommand,
  open: catCommand,
  clear: clearCommand,
  status: statusCommand,
  file: fileCommand,
  head: headCommand,
  tail: tailCommand,
  grep: grepCommand,
  strings: stringsCommand,
  scan: scanCommand,
  analyze: analyzeCommand,
  decrypt: decryptCommand,
  auth: authCommand,
  repair: repairCommand,
  'dev-fx': devFxCommand,
  'dev-speed': devSpeedCommand,
};

export function registerGameCommands(registry: CommandRegistry): void {
  validateCommandManifest();

  for (const command of COMMAND_CATALOG) {
    if (command.devOnly && !import.meta.env.DEV) continue;
    registry.register(command.name, HANDLERS[command.name], command.completion, {
      hidden: command.devOnly,
    });
  }

  for (const alias of COMMAND_ALIASES) {
    registry.alias(alias.alias, alias.target);
  }
}

export function validateCommandManifest(): void {
  const issues: string[] = [];
  const catalogNames = new Set<string>();
  const aliasNames = new Set<string>();
  const validCompletionArgs = new Set(['none', 'path', 'command']);

  for (const command of COMMAND_CATALOG) {
    if (catalogNames.has(command.name)) {
      issues.push(`Duplicate command '${command.name}'`);
    }
    catalogNames.add(command.name);

    if (!/^[a-z][a-z0-9-]*$/.test(command.name)) {
      issues.push(`Command '${command.name}' must use lowercase shell-safe naming`);
    }
    if (!command.description.trim()) {
      issues.push(`Command '${command.name}' is missing description`);
    }
    if (!command.usage.trim()) {
      issues.push(`Command '${command.name}' is missing usage`);
    }
    if (command.examples.length === 0 || command.examples.some(example => !example.trim())) {
      issues.push(`Command '${command.name}' must provide at least one example`);
    }
    if (!command.completion.args) {
      issues.push(`Command '${command.name}' must declare completion.args`);
    } else if (!validCompletionArgs.has(command.completion.args)) {
      issues.push(`Command '${command.name}' uses invalid completion args '${command.completion.args}'`);
    }
    if (!HANDLERS[command.name]) {
      issues.push(`Command '${command.name}' is missing a handler in CommandManifest.ts`);
    }
    if (command.completion.options?.some(option => option.name === '--help' || option.name === '-h')) {
      issues.push(`Command '${command.name}' must not declare --help/-h; registry provides it globally`);
    }
  }

  for (const handlerName of Object.keys(HANDLERS)) {
    if (!catalogNames.has(handlerName)) {
      issues.push(`Handler '${handlerName}' has no COMMAND_CATALOG entry`);
    }
  }

  for (const alias of COMMAND_ALIASES) {
    if (aliasNames.has(alias.alias)) {
      issues.push(`Duplicate alias '${alias.alias}'`);
    }
    aliasNames.add(alias.alias);

    if (!/^[a-z][a-z0-9-]*$/.test(alias.alias)) {
      issues.push(`Alias '${alias.alias}' must use lowercase shell-safe naming`);
    }
    if (catalogNames.has(alias.alias)) {
      issues.push(`Alias '${alias.alias}' conflicts with a command name`);
    }
    if (!catalogNames.has(alias.target)) {
      issues.push(`Alias '${alias.alias}' targets unknown command '${alias.target}'`);
    }
  }

  if (!catalogNames.has('help')) {
    issues.push("Command catalog must include 'help'");
  }

  if (issues.length > 0) {
    throw new Error(`Command manifest validation failed:\n${issues.join('\n')}`);
  }
}
