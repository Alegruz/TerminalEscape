import { GameState } from './GameState.ts';
import { VirtualFileSystem } from '../fs/VirtualFileSystem.ts';
import { PuzzleRegistry } from '../puzzles/PuzzleRegistry.ts';
import { TerminalBuffer } from '../terminal/TerminalBuffer.ts';
import { TerminalRenderer } from '../terminal/TerminalRenderer.ts';
import { CommandRegistry } from '../terminal/CommandRegistry.ts';
import { parseCommand } from '../terminal/CommandParser.ts';
import { InputController } from '../terminal/InputController.ts';
import { Autocomplete } from '../terminal/Autocomplete.ts';
import { THEME } from '../style/theme.ts';
import type { TextColor } from '../style/theme.ts';

// Command handlers.
import { helpCommand }    from '../commands/help.ts';
import { lsCommand }      from '../commands/ls.ts';
import { cdCommand }      from '../commands/cd.ts';
import { pwdCommand }     from '../commands/pwd.ts';
import { catCommand }     from '../commands/cat.ts';
import { clearCommand }   from '../commands/clear.ts';
import { statusCommand }  from '../commands/status.ts';
import { analyzeCommand } from '../commands/analyze.ts';
import { decryptCommand } from '../commands/decrypt.ts';
import { submitCommand }  from '../commands/submit.ts';

// ── Boot sequence lines ──────────────────────────────────────────────────────

interface BootLine {
  text: string;
  delay: number;
  color: TextColor;
}

const BOOT_LINES: BootLine[] = [
  { text: '███████████████████████████████████████████', delay: 0,   color: 'dim' },
  { text: '  ARES-7 MAINTENANCE SYSTEM  v4.1.0',          delay: 60,  color: 'bright' },
  { text: '  Helios Spacecraft Systems Corp.',             delay: 40,  color: 'dim' },
  { text: '███████████████████████████████████████████', delay: 40,  color: 'dim' },
  { text: '',                                              delay: 80,  color: 'normal' },
  { text: '[ BIOS ] Checking hardware...            OK',  delay: 120, color: 'dim' },
  { text: '[ BIOS ] Memory test (512 MB) ...        OK',  delay: 100, color: 'dim' },
  { text: '[ BIOS ] Storage array ...               OK',  delay: 80,  color: 'dim' },
  { text: '',                                              delay: 60,  color: 'normal' },
  { text: '[ BOOT ] Loading kernel modules ...',           delay: 120, color: 'normal' },
  { text: '[ BOOT ] Mounting filesystems ...        OK',  delay: 200, color: 'normal' },
  { text: '[ BOOT ] Starting maintenance daemon ... OK',  delay: 150, color: 'normal' },
  { text: '',                                              delay: 80,  color: 'normal' },
  { text: '[ WARN ] Navigation subsystem: OFFLINE',        delay: 60,  color: 'warning' },
  { text: '[ WARN ] Comms array: DEGRADED',                delay: 60,  color: 'warning' },
  { text: '[ INFO ] Life support: NOMINAL',                delay: 60,  color: 'system' },
  { text: '',                                              delay: 100, color: 'normal' },
  { text: '─────────────────────────────────────────────', delay: 60,  color: 'dim' },
  { text: ' ARES-7 MAINTENANCE TERMINAL — READY',          delay: 80,  color: 'bright' },
  { text: '─────────────────────────────────────────────', delay: 40,  color: 'dim' },
  { text: '',                                              delay: 80,  color: 'normal' },
  { text: "Type 'help' to list commands.  'status' for objectives.", delay: 60, color: 'dim' },
  { text: '',                                              delay: 60,  color: 'normal' },
];

// ── Game ─────────────────────────────────────────────────────────────────────

export class Game {
  private readonly state      = new GameState();
  private readonly vfs        = new VirtualFileSystem();
  private readonly puzzles    = new PuzzleRegistry();
  private readonly buffer     = new TerminalBuffer();
  private readonly renderer   = new TerminalRenderer();
  private readonly registry   = new CommandRegistry();
  private readonly autocomplete = new Autocomplete();
  private inputController!: InputController;

  async init(): Promise<void> {
    await this.renderer.init();
    this.registerCommands();

    this.inputController = new InputController(
      this.onSubmit.bind(this),
      this.onTab.bind(this),
      this.onInputChange.bind(this),
      () => this.state.historyUp(),
      () => this.state.historyDown(),
    );

    this.runBootSequence();
  }

  // ── Command registration ─────────────────────────────────────────────────────

  private registerCommands(): void {
    this.registry.register('help',    helpCommand);
    this.registry.register('ls',      lsCommand);
    this.registry.register('cd',      cdCommand);
    this.registry.register('pwd',     pwdCommand);
    this.registry.register('cat',     catCommand);
    this.registry.register('open',    catCommand);
    this.registry.register('clear',   clearCommand);
    this.registry.register('status',  statusCommand);
    this.registry.register('analyze', analyzeCommand);
    this.registry.register('decrypt', decryptCommand);
    this.registry.register('submit',  submitCommand);
  }

  // ── Boot sequence ────────────────────────────────────────────────────────────

  private runBootSequence(): void {
    this.state.stage = 'boot';
    this.inputController.disable();

    let totalDelay = 0;
    for (const entry of BOOT_LINES) {
      totalDelay += entry.delay;
      const capturedDelay = totalDelay;
      const capturedText  = entry.text;
      const capturedColor = entry.color;
      setTimeout(() => {
        this.buffer.push(capturedText, capturedColor);
        this.refreshDisplay();
      }, capturedDelay);
    }

    setTimeout(() => {
      this.state.stage = 'play';
      this.inputController.enable();
      this.refreshDisplay();
    }, totalDelay + 200);
  }

  // ── Input handlers ───────────────────────────────────────────────────────────

  private onSubmit(rawInput: string): void {
    if (this.state.stage === 'complete') return;

    // Echo the entered command.
    const prompt = this.buildPrompt();
    this.buffer.push(prompt + rawInput, 'input');

    const trimmed = rawInput.trim();
    if (!trimmed) {
      this.refreshDisplay();
      return;
    }

    this.state.pushHistory(trimmed);

    const parsed = parseCommand(trimmed);
    if (!parsed) {
      this.refreshDisplay();
      return;
    }

    const outputLines = this.registry.execute(parsed, {
      state:   this.state,
      vfs:     this.vfs,
      puzzles: this.puzzles,
      buffer:  this.buffer,
    });

    this.buffer.pushLines(outputLines);
    this.refreshDisplay();
  }

  private onTab(currentInput: string): void {
    const result = this.autocomplete.complete(
      currentInput,
      this.state,
      this.vfs,
      this.registry,
    );
    if (!result) return;

    if ('completed' in result) {
      this.inputController.setInput(result.completed);
    } else {
      // Show candidates as a hint line in the buffer.
      this.buffer.push('');
      this.buffer.push(result.candidates.join('   '), 'dim');
      this.buffer.push('');
      this.refreshDisplay();
    }
  }

  private onInputChange(): void {
    this.refreshDisplay();
  }

  // ── Display ──────────────────────────────────────────────────────────────────

  private refreshDisplay(): void {
    const maxLines = this.computeMaxVisibleLines();
    const visible  = this.buffer.getVisibleLines(maxLines);
    this.renderer.render(
      visible,
      this.inputController?.input    ?? '',
      this.inputController?.cursorPos ?? 0,
      this.inputController?.enabled  ?? false,
    );
  }

  private computeMaxVisibleLines(): number {
    const contentH =
      this.renderer.screenHeight - THEME.paddingTop - THEME.paddingBottom;
    return Math.max(1, Math.floor(contentH / THEME.lineHeight));
  }

  private buildPrompt(): string {
    return `ARES-7:${this.state.currentPath} $ `;
  }
}
