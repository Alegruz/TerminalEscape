import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';

const WIN_LINES: OutputLine[] = [
  out(''),
  out('╔════════════════════════════════════════════╗', 'bright'),
  out('║        NAVIGATION RESTORED  ✓              ║', 'bright'),
  out('╠════════════════════════════════════════════╣', 'bright'),
  out('║                                            ║', 'bright'),
  out('║   Core checksum rebuilt.                   ║', 'system'),
  out('║   Escape trajectory calculated.            ║', 'system'),
  out('║   Autopilot engaged.                       ║', 'system'),
  out('║                                            ║', 'bright'),
  out('║   ETA to Earth Station Meridian: 14 days.  ║', 'normal'),
  out('║                                            ║', 'bright'),
  out('║          ★  YOU ESCAPED  ★                ║', 'bright'),
  out('║                                            ║', 'bright'),
  out('╚════════════════════════════════════════════╝', 'bright'),
  out(''),
  out('  Thanks for playing Terminal Escape!', 'dim'),
  out('  Refresh the page to play again.', 'dim'),
  out(''),
];

export function repairCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  const { state, vfs } = ctx;

  if (cmd.args.length === 0) {
    return [
      out('Usage: repair <target> [--with <patch-file>]', 'error'),
      out('repair target required', 'dim'),
    ];
  }

  const requested = cmd.args[0];
  const resolved = vfs.resolve(state.currentPath, requested);
  const directHeader = vfs.getFileHeader(resolved);
  const target = directHeader?.repairFlag
    ? { path: resolved, header: directHeader }
    : vfs.findFileByHeader((header) => header.repairAlias === requested.toLowerCase());

  if (!target?.header.repairFlag) {
    return [out(`repair: ${requested}: unsupported repair target`, 'error')];
  }

  if (target.header.accessFlag && !state.flags[target.header.accessFlag]) {
    return [
      out(`repair: ${target.path}: access denied`, 'error'),
      out(target.header.repairDenied ?? target.header.accessDenied ?? 'authorization required', 'dim'),
    ];
  }

  if (target.header.repairRequiresFlag && !state.flags[target.header.repairRequiresFlag]) {
    return [
      out(`repair: ${target.path}: precheck missing`, 'error'),
      out('scan target before running repair routines', 'dim'),
    ];
  }

  if (target.header.repairRequiresFile) {
    const patchArg = cmd.flags['with'];
    if (typeof patchArg !== 'string') {
      return [
        out(`repair: ${target.path}: patch source required`, 'error'),
        out('scan output and maintenance notes identify the required patch package', 'dim'),
      ];
    }

    const patchPath = vfs.resolve(state.currentPath, patchArg);
    if (patchPath !== target.header.repairRequiresFile) {
      return [
        out(`repair: ${target.path}: patch rejected`, 'error'),
        out('patch signature does not match damaged navigation table', 'dim'),
      ];
    }

    const patchContent = vfs.readFile(patchPath);
    if (patchContent === null) {
      return [
        out(`repair: ${patchPath}: no such patch file`, 'error'),
      ];
    }

    if (
      target.header.repairPatchSignature &&
      !patchContent.includes(target.header.repairPatchSignature)
    ) {
      return [
        out(`repair: ${patchPath}: patch integrity check failed`, 'error'),
        out('signature mismatch', 'dim'),
      ];
    }
  }

  state.flags[target.header.repairFlag] = true;

  if (target.header.repairComplete) {
    state.flags.endingReached = true;
    state.stage = 'complete';
    return WIN_LINES;
  }

  return [
    out(''),
    out(`[REPAIR COMPLETE] ${target.path}`, 'system'),
    out(''),
  ];
}
