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
import {
  SHIP_DIAGNOSTICS,
  formatBootDiagnostic,
  severityColor,
  severityLabel,
} from '../data/diagnostics.ts';

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
import { repairCommand }  from '../commands/repair.ts';

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
  ...SHIP_DIAGNOSTICS.systems.map(formatBootDiagnostic).map(line => ({
    text: line.text,
    delay: 60,
    color: line.color,
  })),
  { text: '',                                              delay: 100, color: 'normal' },
  { text: '─────────────────────────────────────────────', delay: 60,  color: 'dim' },
  { text: ' ARES-7 MAINTENANCE TERMINAL — READY',          delay: 80,  color: 'bright' },
  { text: '─────────────────────────────────────────────', delay: 40,  color: 'dim' },
  { text: '',                                              delay: 80,  color: 'normal' },
  { text: "Type 'help' to list commands.  'status' for diagnostics.", delay: 60, color: 'dim' },
  { text: '',                                              delay: 60,  color: 'normal' },
];

const TIMER_TICK_MS = 1000;

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
  private timerId: number | null = null;
  private nextWarningIndex = 0;
  private scrollOffset = 0;

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

    window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    window.addEventListener('keydown', this.onScrollKey.bind(this));

    this.runBootSequence();
  }

  // ── Command registration ─────────────────────────────────────────────────────

  private registerCommands(): void {
    this.registry.register('help',    helpCommand, { args: 'command' });
    this.registry.register('ls',      lsCommand,   { args: 'path' });
    this.registry.register('cd',      cdCommand,   { args: 'path' });
    this.registry.register('pwd',     pwdCommand,  { args: 'none' });
    this.registry.register('cat',     catCommand,  { args: 'path' });
    this.registry.register('open',    catCommand,  { args: 'path' });
    this.registry.register('clear',   clearCommand, { args: 'none' });
    this.registry.register('status',  statusCommand, { args: 'none' });
    this.registry.register('analyze', analyzeCommand, { args: 'path' });
    this.registry.register('decrypt', decryptCommand, {
      args: 'path',
      options: [
        { name: '--method', values: ['caesar'], requiresValue: true },
        { name: '--key', requiresValue: true },
      ],
    });
    this.registry.register('submit',  submitCommand, { args: 'none' });
    this.registry.register('repair',  repairCommand, { args: 'path' });
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
      this.state.startMissionTimer(SHIP_DIAGNOSTICS.impactDurationMs);
      this.startMissionTimer();
      this.inputController.enable();
      this.buffer.push(
        SHIP_DIAGNOSTICS.timerStartMessage.replace(
          '{time}',
          this.formatTime(SHIP_DIAGNOSTICS.impactDurationMs),
        ),
        'warning',
      );
      this.buffer.push('');
      this.refreshDisplay();
    }, totalDelay + 200);
  }

  // ── Input handlers ───────────────────────────────────────────────────────────

  private onSubmit(rawInput: string): void {
    if (this.state.stage !== 'play') return;
    this.scrollToBottom();

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

    if (this.state.flags.endingReached) {
      this.stopMissionTimer();
    }

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
      this.scrollToBottom();
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
    this.clampScrollOffset(maxLines);
    const visible  = this.buffer.getVisibleLines(maxLines, this.scrollOffset);
    this.renderer.render(
      visible,
      this.inputController?.input    ?? '',
      this.inputController?.cursorPos ?? 0,
      this.inputController?.enabled  ?? false,
      this.buildLiveStatusLine(),
      this.buildPrompt(),
    );
  }

  private computeMaxVisibleLines(): number {
    const contentH =
      this.renderer.screenHeight - THEME.paddingTop - THEME.paddingBottom - THEME.lineHeight;
    return Math.max(1, Math.floor(contentH / THEME.lineHeight));
  }

  private buildPrompt(): string {
    return `ARES-7:${this.state.currentPath} $ `;
  }

  // ── Scrollback ───────────────────────────────────────────────────────────────

  private onWheel(event: WheelEvent): void {
    const maxLines = this.computeMaxVisibleLines();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) return;

    event.preventDefault();
    const lines = Math.max(1, Math.ceil(Math.abs(event.deltaY) / THEME.lineHeight));
    this.scrollBy(direction > 0 ? -lines : lines, maxLines);
  }

  private onScrollKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const maxLines = this.computeMaxVisibleLines();
    switch (event.key) {
      case 'PageUp':
        event.preventDefault();
        this.scrollBy(maxLines, maxLines);
        break;
      case 'PageDown':
        event.preventDefault();
        this.scrollBy(-maxLines, maxLines);
        break;
      case 'End':
        if (this.scrollOffset > 0) {
          event.preventDefault();
          this.scrollToBottom();
        }
        break;
    }
  }

  private scrollBy(deltaLines: number, maxVisibleLines: number): void {
    this.scrollOffset += deltaLines;
    this.clampScrollOffset(maxVisibleLines);
    this.refreshDisplay();
  }

  private scrollToBottom(): void {
    if (this.scrollOffset === 0) return;
    this.scrollOffset = 0;
    this.refreshDisplay();
  }

  private clampScrollOffset(maxVisibleLines: number): void {
    const maxOffset = Math.max(0, this.buffer.lineCount - maxVisibleLines);
    this.scrollOffset = Math.min(Math.max(0, this.scrollOffset), maxOffset);
  }

  // ── Mission timer ────────────────────────────────────────────────────────────

  private startMissionTimer(): void {
    this.stopMissionTimer();
    this.nextWarningIndex = 0;
    this.timerId = window.setInterval(() => this.updateMissionTimer(), TIMER_TICK_MS);
  }

  private stopMissionTimer(): void {
    if (this.timerId === null) return;
    window.clearInterval(this.timerId);
    this.timerId = null;
  }

  private updateMissionTimer(): void {
    if (this.state.stage !== 'play') {
      this.stopMissionTimer();
      return;
    }

    const remainingMs = this.state.getRemainingTimeMs();
    if (remainingMs === null) return;

    while (
      this.nextWarningIndex < SHIP_DIAGNOSTICS.timerEvents.length &&
      remainingMs <= SHIP_DIAGNOSTICS.timerEvents[this.nextWarningIndex].thresholdMs
    ) {
      const event = SHIP_DIAGNOSTICS.timerEvents[this.nextWarningIndex];
      this.buffer.push(
        `[ ${severityLabel(event.severity).padEnd(5)}] ${event.message}`,
        severityColor(event.severity),
      );
      this.nextWarningIndex++;
      this.refreshDisplay();
    }

    this.refreshDisplay();

    if (remainingMs > 0) return;

    this.state.flags.crashReached = true;
    this.state.stage = 'failed';
    this.inputController.disable();
    this.stopMissionTimer();

    for (const line of SHIP_DIAGNOSTICS.failureLines) {
      this.buffer.push(line.text, line.color);
    }

    this.refreshDisplay();
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private buildLiveStatusLine(): string {
    if (this.state.stage === 'boot') return '';
    if (this.state.flags.endingReached) {
      return '[ SYS ] NAV: NOMINAL    [ IMPACT ] CLEARED';
    }
    if (this.state.flags.crashReached) {
      return '[ SYS ] IMPACT EVENT    [ SHIP ] LOST';
    }

    const remainingMs = this.state.getRemainingTimeMs();
    const remainingText = remainingMs === null ? '--:--' : this.formatTime(remainingMs);
    const blockingSystems = SHIP_DIAGNOSTICS.systems
      .filter(system => system.blocksEscape && !this.isSystemRepaired(system.repairedWhen))
      .map(system => `${severityLabel(system.severity)}:${system.id.toUpperCase()}`)
      .join(' ');

    return `[ SYS ] ${blockingSystems || 'ALL NOMINAL'}    [ IMPACT ] ${remainingText}`;
  }

  private isSystemRepaired(repairedWhen: 'navRepaired' | null): boolean {
    if (repairedWhen === null) return false;
    return this.state.flags[repairedWhen];
  }
}
