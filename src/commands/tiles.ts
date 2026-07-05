import type { ParsedCommand } from '../terminal/CommandParser.ts';
import type { CommandContext, OutputLine } from '../terminal/CommandRegistry.ts';
import { out } from '../terminal/CommandRegistry.ts';
import { securityViolationLines } from '../data/security.ts';

const MAX_SAFE_MOVES = 3;

export function tilesCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  if (ctx.state.flags.tilesCrashed) {
    return [
      out(''),
      out('BastionOS Tiles cannot be restarted in recovery mode.', 'error'),
      out("Try 'help' if you need recovery commands.", 'dim'),
      out(''),
    ];
  }

  if (!ctx.state.flags.tilesStarted) {
    ctx.state.flags.tilesStarted = true;
    return [
      out(''),
      out('BastionOS Tiles 1.1', 'bright'),
      out('──────────────────', 'dim'),
      out(''),
      ...renderBoard(ctx.state.tilesMoveCount),
      out(''),
      out('Objective: slide numbered tiles into the empty cell.', 'dim'),
      out("Use: tiles <number>    Example: tiles 5", 'dim'),
      out(''),
    ];
  }

  const tile = cmd.args[0];
  if (!tile || !/^\d+$/.test(tile)) {
    return [
      out(''),
      ...renderBoard(ctx.state.tilesMoveCount),
      out(''),
      out("Choose a tile to slide: tiles <number>", 'dim'),
      out(''),
    ];
  }

  ctx.state.tilesMoveCount++;

  if (ctx.state.tilesMoveCount < MAX_SAFE_MOVES) {
    return [
      out(''),
      out(`Tile ${tile.padStart(2, '0')} moved.`, 'system'),
      out(''),
      ...renderBoard(ctx.state.tilesMoveCount),
      out(''),
      out(`${MAX_SAFE_MOVES - ctx.state.tilesMoveCount} moves until board validation.`, 'dim'),
      out(''),
    ];
  }

  ctx.state.flags.tilesCrashed = true;
  ctx.state.flags.timerStarted = true;

  return [
    out(''),
    out(`Tile ${tile.padStart(2, '0')} moved.`, 'system'),
    out('Board validation requested...', 'dim'),
    ...securityViolationLines('recovery shell / local game sandbox'),
  ];
}

function renderBoard(moveCount: number): OutputLine[] {
  const boards = [
    [
      '  [01] [02] [03]',
      '  [04] [  ] [05]',
      '  [06] [07] [08]',
    ],
    [
      '  [01] [02] [03]',
      '  [  ] [04] [05]',
      '  [06] [07] [08]',
    ],
    [
      '  [01] [02] [03]',
      '  [06] [04] [05]',
      '  [  ] [07] [08]',
    ],
  ];

  const board = boards[Math.min(moveCount, boards.length - 1)];
  return [
    out('Current board:', 'normal'),
    out(''),
    ...board.map(line => out(line, 'normal')),
    out(''),
  ];
}
