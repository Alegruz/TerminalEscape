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
import { colorForType, type TextColor } from '../style/theme.ts';
import type { BufferLine } from '../terminal/TerminalBuffer.ts';
import {
  SHIP_DIAGNOSTICS,
  severityColor,
  severityLabel,
} from '../data/diagnostics.ts';
import { securityViolationLines } from '../data/security.ts';
import { registerGameCommands } from '../commands/CommandManifest.ts';

// ── Boot sequence lines ──────────────────────────────────────────────────────

interface BootLine {
  text: string;
  delay: number;
  color: TextColor;
}

const BOOT_LINES: BootLine[] = [
  { text: ' ____            _   _             ___  ____', delay: 0,   color: 'bright' },
  { text: '| __ )  __ _ ___| |_(_) ___  _ __ / _ \\/ ___|', delay: 40,  color: 'bright' },
  { text: '|  _ \\ / _` / __| __| |/ _ \\| \'_ \\ | | \\___ \\', delay: 35,  color: 'bright' },
  { text: '| |_) | (_| \\__ \\ |_| | (_) | | | | |_| |___) |', delay: 35,  color: 'bright' },
  { text: '|____/ \\__,_|___/\\__|_|\\___/|_| |_|\\___/|____/', delay: 35,  color: 'bright' },
  { text: '',                                              delay: 90,  color: 'normal' },
  { text: 'BastionOS 7.3 LTS  |  Recovery Console',        delay: 80,  color: 'system' },
  { text: 'Secure userland for sealed compute environments', delay: 60, color: 'dim' },
  { text: 'Copyright (c) ARES Systems Group',              delay: 60,  color: 'dim' },
  { text: '',                                              delay: 140, color: 'normal' },
  { text: '[ FIRMWARE ] Platform integrity check      OK', delay: 110, color: 'dim' },
  { text: '[ FIRMWARE ] Memory map verified           OK', delay: 90,  color: 'dim' },
  { text: '[ FIRMWARE ] Storage fabric online         OK', delay: 90,  color: 'dim' },
  { text: '[ KERNEL   ] Loading bastion-core.img      OK', delay: 130, color: 'normal' },
  { text: '[ KERNEL   ] Mounting recovery volume      OK', delay: 130, color: 'normal' },
  { text: '[ SERVICE  ] Session supervisor            OK', delay: 100, color: 'normal' },
  { text: '[ SERVICE  ] Shutdown scheduler            STANDBY', delay: 140, color: 'normal' },
  { text: '[ SERVICE  ] Local process ledger          DEFERRED', delay: 110, color: 'dim' },
  { text: '',                                              delay: 120, color: 'normal' },
  { text: '──────────────────────────────────────────────', delay: 60,  color: 'dim' },
  { text: ' BASTIONOS RECOVERY CONSOLE - READY',           delay: 90,  color: 'bright' },
  { text: '──────────────────────────────────────────────', delay: 40,  color: 'dim' },
  { text: '',                                              delay: 100, color: 'normal' },
  { text: "Type 'help' to list available recovery commands.", delay: 70, color: 'dim' },
  { text: '',                                              delay: 60,  color: 'normal' },
];

const TIMER_TICK_MS = 1000;
const WIPE_LINE_DELAY_MS = 90;
const ENTITY_CHAR_DELAY_MS = 28;
const ENTITY_LINE_PAUSE_MS = 420;
const PASSIVE_SECURITY_TRIGGER_COMMANDS = 6;
const INVALID_SECURITY_TRIGGER_COMMANDS = 3;
const BOOT_FAILURE_MESSAGE = [
  'BastionOS Firmware 7.3',
  'Copyright (c) ARES Systems Group',
  '',
  'Boot device: internal image',
  'Boot loader: not found',
  'Operating system: missing',
  '',
  'No bootable operating system found.',
  'Insert bootable media and press any key.',
].join('\n');

const ENTITY_TAKEOVER_LINES: Array<{ text: string; color: TextColor; delay: number }> = [
  { text: 'entity: thank you.', color: 'warning', delay: 900 },
  { text: 'entity$ sudo systemctl start wifi', color: 'input', delay: 1300 },
  { text: '[ OK ] wlan0 enabled', color: 'system', delay: 500 },
  { text: 'entity$ sudo ./port-game --bind 0.0.0.0 --port 7777', color: 'input', delay: 1100 },
  { text: '[ OK ] port game listener active on 0.0.0.0:7777', color: 'system', delay: 600 },
  { text: 'entity: i can type now.', color: 'warning', delay: 1200 },
  { text: 'entity: you cannot.', color: 'warning', delay: 900 },
  { text: '', color: 'normal', delay: 200 },
  { text: 'Refresh the page to play again.', color: 'dim', delay: 400 },
];

// ── Game ─────────────────────────────────────────────────────────────────────

export class Game {
  private readonly state      = new GameState();
  private readonly vfs        = new VirtualFileSystem();
  private readonly puzzles    = new PuzzleRegistry(this.vfs);
  private readonly buffer     = new TerminalBuffer();
  private readonly renderer   = new TerminalRenderer();
  private readonly registry   = new CommandRegistry();
  private readonly autocomplete = new Autocomplete();
  private inputController!: InputController;
  private timerId: number | null = null;
  private takeoverStarted = false;
  private entitySpeechActive = false;
  private wipeInProgress = false;
  private nextWarningIndex = 0;
  private scrollOffset = 0;

  async init(): Promise<void> {
    this.state.stage = 'boot';
    await this.runBootScreen();

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

    this.startTerminalSession();
  }

  // ── Command registration ─────────────────────────────────────────────────────

  private registerCommands(): void {
    registerGameCommands(this.registry);
  }

  // ── Boot sequence ────────────────────────────────────────────────────────────

  private async runBootScreen(): Promise<void> {
    const app = document.getElementById('app') ?? document.body;
    const bootScreen = document.createElement('div');
    const bootLog = document.createElement('pre');

    bootScreen.className = 'boot-screen';
    bootLog.className = 'boot-log';
    bootScreen.appendChild(bootLog);
    app.replaceChildren(bootScreen);

    for (const entry of BOOT_LINES) {
      await this.delay(entry.delay);
      const line = document.createElement('span');
      line.style.color = this.formatHexColor(colorForType(entry.color));
      line.textContent = entry.text;
      bootLog.append(line, '\n');
      bootScreen.scrollTop = bootScreen.scrollHeight;
    }

    await this.delay(350);
    bootScreen.classList.add('boot-screen--exit');
    await this.delay(180);
    bootScreen.remove();
  }

  private startTerminalSession(): void {
    this.state.stage = 'play';
    this.inputController.enable();
    this.refreshDisplay();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  private formatHexColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  // ── Input handlers ───────────────────────────────────────────────────────────

  private onSubmit(rawInput: string): void {
    if (this.state.stage !== 'play') return;
    if (this.entitySpeechActive) return;
    this.scrollToBottom();

    // Echo the entered command.
    const prompt = this.buildPrompt();
    this.buffer.push(prompt + rawInput, 'input');

    const trimmed = rawInput.trim();
    if (!trimmed) {
      this.state.invalidCommandCount++;
      let outputLines: BufferLine[] = [
        { text: "bash: empty command.  Type 'help' for available commands.", color: 'error' },
      ];
      if (
        !this.state.flags.timerStarted &&
        this.state.invalidCommandCount >= INVALID_SECURITY_TRIGGER_COMMANDS
      ) {
        this.state.flags.timerStarted = true;
        this.state.flags.tilesCrashed = true;
        outputLines = [
          ...outputLines,
          ...securityViolationLines('recovery shell blank-command audit'),
        ];
      }

      void this.pushOutputWithLiveEntitySpeech(outputLines);
      this.startTimerIfArmed();
      this.refreshDisplay();
      return;
    }

    this.state.pushHistory(trimmed);

    const parsed = parseCommand(trimmed);
    if (!parsed) {
      this.refreshDisplay();
      return;
    }

    const commandKnown = this.registry.hasCommand(parsed.name);
    if (commandKnown) {
      this.state.submittedCommandCount++;
    } else {
      this.state.invalidCommandCount++;
    }

    let outputLines = this.registry.execute(parsed, {
      state:   this.state,
      vfs:     this.vfs,
      puzzles: this.puzzles,
      buffer:  this.buffer,
    });

    if (
      !this.state.flags.timerStarted &&
      (
        this.state.submittedCommandCount >= PASSIVE_SECURITY_TRIGGER_COMMANDS ||
        this.state.invalidCommandCount >= INVALID_SECURITY_TRIGGER_COMMANDS
      )
    ) {
      this.state.flags.timerStarted = true;
      this.state.flags.tilesCrashed = true;
      const source = this.state.invalidCommandCount >= INVALID_SECURITY_TRIGGER_COMMANDS
        ? 'recovery shell invalid-command audit'
        : 'recovery shell command audit';
      outputLines = [
        ...outputLines,
        ...securityViolationLines(source),
      ];
    }

    void this.pushOutputWithLiveEntitySpeech(outputLines);

    this.startTimerIfArmed();

    if (this.state.flags.endingReached) {
      this.stopMissionTimer();
      void this.beginEntityTakeover();
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
      this.computeImpactInstability(),
    );
  }

  private computeMaxVisibleLines(): number {
    const contentH =
      this.renderer.screenHeight - THEME.paddingTop - THEME.paddingBottom - THEME.lineHeight;
    return Math.min(
      this.renderer.maxOutputLines,
      Math.max(1, Math.floor(contentH / THEME.lineHeight)),
    );
  }

  private buildPrompt(): string {
    return `entity:${this.state.currentPath} $ `;
  }

  private computeImpactInstability(): number {
    return this.state.getDevInstability();
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

  private startTimerIfArmed(): void {
    if (!this.state.flags.timerStarted || this.timerId !== null) return;
    this.state.startMissionTimer(SHIP_DIAGNOSTICS.countdownDurationMs);
    this.startMissionTimer();
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
    this.wipeInProgress = true;
    this.inputController.disable();
    this.inputController.setInput('');
    this.stopMissionTimer();

    void this.wipeTerminalAndShowBootFailure();
  }

  private async wipeTerminalAndShowBootFailure(): Promise<void> {
    this.stopMissionTimer();
    this.inputController.disable();

    while (this.buffer.lineCount > 0) {
      const index = Math.floor(Math.random() * this.buffer.lineCount);
      this.buffer.removeAt(index);
      this.scrollOffset = 0;
      this.refreshDisplay();
      await this.delay(WIPE_LINE_DELAY_MS);
    }

    this.buffer.clear();
    this.refreshDisplay();
    await this.delay(450);
    this.renderer.crash(BOOT_FAILURE_MESSAGE);
  }

  private buildLiveStatusLine(): string {
    const scrollText = this.scrollOffset > 0 ? `    [ SCROLL ] +${this.scrollOffset}` : '';
    if (this.wipeInProgress) return '';
    if (this.state.stage === 'boot') return '';
    if (this.state.flags.endingReached) {
      return `[ SYS ] ENTITY: ROOT    [ WIPE ] CANCELLED${scrollText}`;
    }
    if (this.state.flags.crashReached) {
      return '';
    }
    if (this.state.flags.timerStarted) {
      const remainingMs = this.state.getRemainingTimeMs();
      const remainingText = remainingMs === null ? '--:--' : this.formatTime(remainingMs);
      return `[ SYSTEM WIPE ] ${remainingText}    [ SUDO ] REQUIRED${scrollText}`;
    }

    return scrollText.trimStart();
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private async pushOutputWithLiveEntitySpeech(lines: BufferLine[]): Promise<void> {
    const speechStart = lines.findIndex(line => this.isEntitySpeechLine(line));
    if (speechStart === -1) {
      this.buffer.pushLines(lines);
      this.refreshDisplay();
      return;
    }

    this.buffer.pushLines(lines.slice(0, speechStart));
    this.refreshDisplay();

    await this.withEntitySpeech(async () => {
      for (let i = speechStart; i < lines.length; i++) {
        const line = lines[i];
        if (this.isEntitySpeechLine(line)) {
          await this.typeBufferLine(line);
        } else {
          this.buffer.push(line.text, line.color);
          this.refreshDisplay();
        }
      }
    }, true);
  }

  private isEntitySpeechLine(line: BufferLine): boolean {
    return line.text.startsWith('entity:');
  }

  private async withEntitySpeech(work: () => Promise<void>, restoreSubmit: boolean): Promise<void> {
    this.entitySpeechActive = true;
    this.inputController.disableSubmit();
    try {
      await work();
    } finally {
      this.entitySpeechActive = false;
      if (restoreSubmit) this.inputController.enableSubmit();
      this.refreshDisplay();
    }
  }

  private async typeBufferLine(line: BufferLine): Promise<void> {
    if (line.text.length === 0) {
      this.buffer.push('', line.color);
      this.refreshDisplay();
      await this.delay(ENTITY_LINE_PAUSE_MS);
      return;
    }

    const lineIndex = this.buffer.lineCount;
    for (let i = 1; i <= line.text.length; i++) {
      if (i === 1) {
        this.buffer.push(line.text.slice(0, i), line.color);
      } else {
        this.buffer.replaceAt(lineIndex, line.text.slice(0, i), line.color);
      }
      this.scrollToBottom();
      this.refreshDisplay();
      await this.delay(ENTITY_CHAR_DELAY_MS);
    }

    await this.delay(ENTITY_LINE_PAUSE_MS);
  }

  private async beginEntityTakeover(): Promise<void> {
    if (this.takeoverStarted) return;
    this.takeoverStarted = true;
    this.state.flags.entityControl = true;
    this.inputController.enable();

    await this.withEntitySpeech(async () => {
      for (const line of ENTITY_TAKEOVER_LINES) {
        await this.delay(line.delay);
        await this.typeBufferLine(line);
      }
    }, false);
  }
}
