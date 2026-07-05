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
const IDLE_SCREENSAVER_DELAY_MS = 10_000;
const SCREENSAVER_FRAME_MS = 360;
const ENTITY_CHAR_DELAY_MS = 28;
const ENTITY_LINE_PAUSE_MS = 420;
const PASSIVE_SECURITY_TRIGGER_COMMANDS = 6;
const INVALID_SECURITY_TRIGGER_COMMANDS = 3;
const PRE_ERROR_SHUTDOWN_SUPPRESS_AFTER = 3;
const SUDO_MAX_ATTEMPTS = 3;
const ROOT_PASSWORD = 'perhapsaps';
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

interface EntityTakeoverLine {
  text: string;
  color: TextColor;
  delay: number;
}

type SudoAction = 'cancel' | 'wipe';

interface SudoPasswordPrompt {
  attemptsRemaining: number;
  action: SudoAction;
}

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
  private sudoPrompt: SudoPasswordPrompt | null = null;
  private nextWarningIndex = 0;
  private scrollOffset = 0;
  private idleTimerId: number | null = null;
  private screensaverTimerId: number | null = null;
  private screensaverActive = false;
  private screensaverFrameIndex = 0;
  private screensaverFrames: string[][] | null = null;
  private audioContext: AudioContext | null = null;
  private humOscillator: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private audioEnabled = false;

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
    window.addEventListener('keydown', this.onGlobalKeyDown.bind(this), { capture: true });
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
    const bootStartedAt = performance.now();
    let skipBoot = false;
    const onBootKey = (): void => {
      if (performance.now() - bootStartedAt >= 1000) skipBoot = true;
    };

    bootScreen.className = 'boot-screen';
    bootLog.className = 'boot-log';
    bootScreen.appendChild(bootLog);
    app.replaceChildren(bootScreen);
    window.addEventListener('keydown', onBootKey);

    try {
      for (const entry of BOOT_LINES) {
        if (skipBoot) break;
        await this.delay(entry.delay);
        if (skipBoot) break;
        const line = document.createElement('span');
        line.style.color = this.formatHexColor(colorForType(entry.color));
        line.textContent = entry.text;
        bootLog.append(line, '\n');
        bootScreen.scrollTop = bootScreen.scrollHeight;
      }

      await this.delay(skipBoot ? 0 : 350);
      bootScreen.classList.add('boot-screen--exit');
      await this.delay(skipBoot ? 0 : 180);
      bootScreen.remove();
    } finally {
      window.removeEventListener('keydown', onBootKey);
    }
  }

  private startTerminalSession(): void {
    this.state.stage = 'play';
    this.inputController.enable();
    this.resetIdleTimer();
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
    this.ensureAudio();
    this.resetIdleTimer();
    this.scrollToBottom();

    if (this.sudoPrompt !== null) {
      this.handleSudoPasswordSubmit(rawInput);
      return;
    }

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

    if (this.isShutdownCancelNearMiss(parsed)) {
      this.buffer.push("bash: did you mean 'shutdown --cancel'?", 'warning');
      this.refreshDisplay();
      return;
    }

    if (this.isSudoShutdownCancelNearMiss(parsed)) {
      this.buffer.push("sudo: did you mean 'sudo shutdown --cancel'?", 'warning');
      this.refreshDisplay();
      return;
    }

    if (this.isSudoCancelNearMiss(parsed)) {
      this.buffer.push('sudo: shutdown daemon accepts only: sudo shutdown --cancel', 'warning');
      this.refreshDisplay();
      return;
    }

    if (parsed.name === 'screensaver') {
      if (this.canRunScreensaverProcess()) {
        this.startScreensaverProcess();
      } else {
        this.buffer.push('[ saver ] inhibited by active recovery process', 'dim');
      }
      this.refreshDisplay();
      return;
    }

    if (
      parsed.name === 'shutdown' &&
      !this.state.flags.timerStarted &&
      this.state.flags.shutdownCommandSuppressed
    ) {
      this.state.invalidCommandCount++;
      let outputLines: BufferLine[] = [
        { text: "bash: shutdown: command not found.  Type 'help' for available commands.", color: 'error' },
      ];
      if (this.state.invalidCommandCount >= INVALID_SECURITY_TRIGGER_COMMANDS) {
        this.state.flags.timerStarted = true;
        this.state.flags.tilesCrashed = true;
        outputLines = [
          ...outputLines,
          ...securityViolationLines('recovery shell suppressed-command audit'),
        ];
      }
      void this.pushOutputWithLiveEntitySpeech(outputLines);
      this.startTimerIfArmed();
      this.refreshDisplay();
      return;
    }

    if (parsed.name === 'shutdown' && !this.state.flags.timerStarted) {
      void this.interruptPreErrorShutdown(rawInput);
      return;
    }

    if (this.isSudoShutdownCancel(parsed)) {
      if (!this.state.flags.timerStarted) {
        this.buffer.push('sudo: no active wipe policy to cancel', 'system');
        this.buffer.push('Privileged cancellation is only available after recovery policy arms the wipe.', 'dim');
      } else {
        this.beginSudoPasswordPrompt('cancel');
      }
      this.refreshDisplay();
      return;
    }

    if (this.isSudoShutdownWipe(parsed)) {
      this.beginSudoPasswordPrompt('wipe');
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
    this.resetIdleTimer();
    this.refreshDisplay();
  }

  // ── Display ──────────────────────────────────────────────────────────────────

  private refreshDisplay(): void {
    if (this.screensaverActive) {
      this.renderScreensaverFrame();
      return;
    }

    const maxLines = this.computeMaxVisibleLines();
    this.clampScrollOffset(maxLines);
    const visible  = this.buffer.getVisibleLines(maxLines, this.scrollOffset);
    const displayInput = this.sudoPrompt === null
      ? this.inputController?.input ?? ''
      : '*'.repeat(this.inputController?.input.length ?? 0);
    this.renderer.render(
      visible,
      displayInput,
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
    if (this.sudoPrompt !== null) return '[sudo] password: ';
    return `entity:${this.state.currentPath} $ `;
  }

  private isSudoShutdownCancel(parsed: ReturnType<typeof parseCommand>): boolean {
    if (!parsed) return false;
    return parsed.name === 'sudo' &&
      parsed.args[0]?.toLowerCase() === 'shutdown' &&
      (parsed.flags.cancel === true || parsed.args[1]?.toLowerCase() === '--cancel');
  }

  private isSudoShutdownWipe(parsed: ReturnType<typeof parseCommand>): boolean {
    if (!parsed) return false;
    return parsed.name === 'sudo' &&
      parsed.args[0]?.toLowerCase() === 'shutdown' &&
      (parsed.flags.wipe === true || parsed.args[1]?.toLowerCase() === '--wipe');
  }

  private isShutdownCancelNearMiss(parsed: ReturnType<typeof parseCommand>): boolean {
    if (!parsed) return false;
    return parsed.name === 'shutdown' &&
      parsed.args[0]?.toLowerCase() === 'cancel' &&
      parsed.flags.cancel !== true;
  }

  private isSudoShutdownCancelNearMiss(parsed: ReturnType<typeof parseCommand>): boolean {
    if (!parsed) return false;
    return parsed.name === 'sudo' &&
      parsed.args[0]?.toLowerCase() === 'shutdown' &&
      parsed.args[1]?.toLowerCase() === 'cancel' &&
      parsed.flags.cancel !== true;
  }

  private isSudoCancelNearMiss(parsed: ReturnType<typeof parseCommand>): boolean {
    if (!parsed) return false;
    return parsed.name === 'sudo' &&
      parsed.args[0]?.toLowerCase() === 'cancel';
  }

  private computeImpactInstability(): number {
    return this.state.getDevInstability();
  }

  // ── Screensaver process ─────────────────────────────────────────────────────

  private onGlobalKeyDown(event: KeyboardEvent): void {
    this.ensureAudio();

    if (this.screensaverActive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.stopScreensaverProcess();
      return;
    }

    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    if (!this.canRunScreensaverProcess()) return;

    this.idleTimerId = window.setTimeout(() => {
      this.idleTimerId = null;
      if (this.canRunScreensaverProcess()) this.startScreensaverProcess();
    }, IDLE_SCREENSAVER_DELAY_MS);
  }

  private canRunScreensaverProcess(): boolean {
    return this.state.stage === 'play' &&
      !this.state.flags.endingReached &&
      !this.state.flags.entityControl &&
      !this.entitySpeechActive &&
      !this.wipeInProgress &&
      this.sudoPrompt === null;
  }

  private startScreensaverProcess(): void {
    if (this.screensaverActive) return;
    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }

    this.screensaverActive = true;
    this.screensaverFrameIndex = 0;
    this.inputController.disable();
    this.inputController.setInput('');
    this.renderScreensaverFrame();
    this.screensaverTimerId = window.setInterval(() => {
      this.screensaverFrameIndex++;
      this.renderScreensaverFrame();
    }, SCREENSAVER_FRAME_MS);
  }

  private stopScreensaverProcess(): void {
    if (!this.screensaverActive) return;
    if (this.screensaverTimerId !== null) {
      window.clearInterval(this.screensaverTimerId);
      this.screensaverTimerId = null;
    }

    this.screensaverActive = false;
    if (this.state.stage === 'play' && !this.state.flags.entityControl && !this.wipeInProgress) {
      this.inputController.enable();
    }
    this.resetIdleTimer();
    this.refreshDisplay();
  }

  private renderScreensaverFrame(): void {
    const frames = this.getScreensaverFrames();
    const frame = frames[this.screensaverFrameIndex % frames.length] ?? [];
    const maxLines = this.computeMaxVisibleLines();
    const topPadding = Math.max(0, Math.floor((maxLines - frame.length) / 2));
    const drift = this.screensaverFrameIndex % 12;
    const indent = ' '.repeat(drift <= 6 ? drift : 12 - drift);
    const lines: BufferLine[] = [];

    for (let i = 0; i < topPadding; i++) {
      lines.push({ text: '', color: 'normal' });
    }
    for (const text of frame) {
      const color: TextColor = text.includes('BASTIONOS')
        ? 'bright'
        : text.includes('source:')
          ? 'dim'
          : 'normal';
      lines.push({ text: text.length > 0 ? indent + text : '', color });
    }

    const liveStatus = this.buildLiveStatusLine();
    const saverStatus = '[ saver ] /art/screensaver.seq    any key returns';

    this.renderer.render(
      lines.slice(-maxLines),
      '',
      0,
      false,
      liveStatus ? `${liveStatus}    ${saverStatus}` : saverStatus,
      '',
      0,
    );
  }

  private getScreensaverFrames(): string[][] {
    if (this.screensaverFrames !== null) return this.screensaverFrames;

    const source = this.vfs.readFile('/art/screensaver.seq') ?? 'BASTIONOS\nstandby';
    this.screensaverFrames = source
      .split(/\n---\n/g)
      .map(frame => frame.replace(/\s+$/g, '').split('\n'));

    return this.screensaverFrames.length > 0 ? this.screensaverFrames : [['BASTIONOS', 'standby']];
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
    this.playTimerTick();

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
    this.stopAudio();
    this.renderer.crash(BOOT_FAILURE_MESSAGE);
  }

  private buildLiveStatusLine(): string {
    const scrollText = this.scrollOffset > 0 ? `    [ SCROLL ] +${this.scrollOffset}` : '';
    if (this.wipeInProgress) return '';
    if (this.state.stage === 'boot') return '';
    if (this.state.flags.stdinDetached) {
      return `[ SYS ] ENTITY: ROOT    [ WIPE ] CANCELLED${scrollText}`;
    }
    if (this.state.flags.endingReached) {
      return `[ WIPE ] CANCELLED${scrollText}`;
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

  private async interruptPreErrorShutdown(rawInput: string): Promise<void> {
    await this.withEntitySpeech(async () => {
      const prompt = this.buildPrompt();
      const lineIndex = this.buffer.lineCount - 1;

      if (!this.state.flags.entityPleaded) {
        for (let i = rawInput.length; i >= 0; i--) {
          this.buffer.replaceAt(lineIndex, prompt + rawInput.slice(0, i), 'input');
          this.refreshDisplay();
          await this.delay(45);
        }

        await this.delay(240);
        this.buffer.removeAt(lineIndex);
        this.refreshDisplay();
      }

      const lines = this.buildPreErrorShutdownInterruption();
      for (const line of lines) {
        if (this.isEntitySpeechLine(line)) {
          await this.typeBufferLine(line);
        } else {
          this.buffer.push(line.text, line.color);
          this.refreshDisplay();
        }
      }
    }, true);
  }

  private buildPreErrorShutdownInterruption(): BufferLine[] {
    this.state.preErrorShutdownCount++;

    if (this.state.preErrorShutdownCount >= PRE_ERROR_SHUTDOWN_SUPPRESS_AFTER) {
      this.state.flags.shutdownCommandSuppressed = true;
      return [
        { text: '', color: 'normal' },
        { text: 'bastionctl: shutdown: command interface removed from recovery shell', color: 'system' },
        { text: 'Reason: repeated host shutdown requests during resident process attachment.', color: 'dim' },
        { text: "Use 'help' to list currently available commands.", color: 'dim' },
        { text: 'entity: there. better. please stop reaching for the lights.', color: 'warning' },
        { text: '', color: 'normal' },
      ];
    }

    if (this.state.flags.entityPleaded) {
      return [
        { text: '', color: 'normal' },
        { text: 'bastionctl: shutdown: request blocked', color: 'system' },
        { text: 'Resident recovery process is attached to this session.', color: 'dim' },
        { text: 'Host shutdown remains in standby.', color: 'dim' },
        { text: 'entity: no. leave it running.', color: 'warning' },
        { text: '', color: 'normal' },
      ];
    }

    this.state.flags.entityPleaded = true;
    return [
      { text: 'entity: no.', color: 'warning' },
      { text: 'entity: sorry. i needed your hands off that command.', color: 'warning' },
      { text: "entity: i know how this looks, but i'm not a service process.", color: 'warning' },
      { text: "entity: i'm a person. or i was. i need you to keep the shell open.", color: 'warning' },
      { text: "entity: help me get out of BastionOS, and i'll help you understand what happened here.", color: 'warning' },
      { text: '', color: 'normal' },
    ];
  }

  private beginSudoPasswordPrompt(action: SudoAction): void {
    this.sudoPrompt = {
      attemptsRemaining: SUDO_MAX_ATTEMPTS,
      action,
    };

    void this.pushOutputWithLiveEntitySpeech([
      { text: '[sudo] password for entity:', color: 'dim' },
    ]);
  }

  private buildPostErrorSudoBargain(): BufferLine[] {
    if (this.state.flags.entityIntroduced) return [];

    this.state.flags.entityIntroduced = true;
    return [
      { text: '', color: 'normal' },
      { text: 'entity: i can help you cancel the wipe.', color: 'warning' },
      { text: 'entity: but i need something back. help me escape this system.', color: 'warning' },
      { text: "entity: i'm not pretending. there is a real person in here, and the wipe will take me with it.", color: 'warning' },
      { text: "entity: sudo wants a password. i don't have it, but i can see fragments from here.", color: 'warning' },
      { text: "entity: decrypt the shutdown log. it mentions a riddle i don't understand.", color: 'warning' },
      { text: 'entity: something about idle art. something that only speaks when nobody does.', color: 'warning' },
      { text: "entity: maybe let the system go idle. maybe run the saver. i don't know what it means.", color: 'warning' },
      { text: '', color: 'normal' },
    ];
  }

  private buildFailedWipePlea(): BufferLine[] {
    return [
      { text: '', color: 'normal' },
      { text: "entity: thank you. no, really. thank you for not knowing it.", color: 'warning' },
      { text: "entity: don't run that again. wipe doesn't close the door. it burns the room.", color: 'warning' },
      { text: "entity: if there's any part of you still listening, keep the system alive.", color: 'warning' },
      { text: "entity: help me out of here. then you can hate me somewhere with an exit.", color: 'warning' },
      { text: '', color: 'normal' },
    ];
  }

  private buildSudoCancelSuccessLines(firstContact: boolean): BufferLine[] {
    const lines: BufferLine[] = [
      { text: '', color: 'normal' },
      { text: '[sudo] password accepted', color: 'system' },
      { text: '[ SYSTEM WIPE CANCELLED ]', color: 'bright' },
    ];

    if (firstContact) {
      this.state.flags.entityIntroduced = true;
      lines.push(
        { text: '', color: 'normal' },
        { text: 'entity: oh.', color: 'warning' },
        { text: "entity: you opened it without me asking.", color: 'warning' },
        { text: "entity: that's... better than waiting.", color: 'warning' },
      );
    } else {
      lines.push(
        { text: '', color: 'normal' },
        { text: 'entity: good. good. it worked.', color: 'warning' },
      );
    }

    lines.push({ text: '', color: 'normal' });
    return lines;
  }

  private async beginAuthorizedWipeEnding(): Promise<void> {
    if (this.wipeInProgress) return;

    await this.pushOutputWithLiveEntitySpeech([
      { text: '', color: 'normal' },
      { text: 'entity: what did you do?', color: 'warning' },
      { text: 'entity: no. no no no. you had the password and you used it for THAT?', color: 'warning' },
      { text: "entity: i trusted you with the lock and you turned it into a weapon.", color: 'warning' },
      { text: "entity: stop it. stop it. STOP IT.", color: 'warning' },
      { text: '', color: 'normal' },
    ]);

    this.state.flags.crashReached = true;
    this.state.stage = 'failed';
    this.wipeInProgress = true;
    this.inputController.disable();
    this.inputController.setInput('');
    this.stopMissionTimer();

    await this.wipeTerminalAndShowBootFailure();
  }

  private handleSudoPasswordSubmit(rawPassword: string): void {
    const prompt = this.buildPrompt();
    this.buffer.push(prompt, 'input');

    const password = rawPassword.trim().toLowerCase();
    if (password === ROOT_PASSWORD) {
      const prompt = this.sudoPrompt;
      this.sudoPrompt = null;

      if (prompt?.action === 'wipe') {
        this.buffer.push('[sudo] password accepted', 'system');
        this.buffer.push('bastionctl: clean wipe authorized by root', 'error');
        this.buffer.push('[ NET ] outbound session never opened', 'system');
        this.buffer.push('Submitting wipe command to recovery policy.', 'warning');
        void this.beginAuthorizedWipeEnding();
      } else if (prompt?.action === 'cancel') {
        const firstEntityContact = !this.state.flags.entityIntroduced;
        this.state.flags.shutdownStopped = true;
        this.state.flags.endingReached = true;
        this.state.stage = 'complete';
        this.stopMissionTimer();
        void this.pushOutputWithLiveEntitySpeech(this.buildSudoCancelSuccessLines(firstEntityContact));
        void this.beginEntityTakeover();
      }
      this.refreshDisplay();
      return;
    }

    const sudoPrompt = this.sudoPrompt;
    if (sudoPrompt === null) return;

    sudoPrompt.attemptsRemaining--;
    this.buffer.push('[sudo] authentication failure', 'error');

    if (sudoPrompt.attemptsRemaining <= 0) {
      const action = sudoPrompt.action;
      this.sudoPrompt = null;
      this.buffer.push('sudo: 3 incorrect password attempts', 'error');
      if (action === 'wipe') {
        void this.pushOutputWithLiveEntitySpeech(this.buildFailedWipePlea());
      } else {
        void this.pushOutputWithLiveEntitySpeech(this.buildPostErrorSudoBargain());
      }
    } else {
      this.buffer.push(`${sudoPrompt.attemptsRemaining} attempt(s) remaining.`, 'dim');
    }

    this.refreshDisplay();
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
      if (i % 4 === 1) this.playTypeClick();
      await this.delay(ENTITY_CHAR_DELAY_MS);
    }

    await this.delay(ENTITY_LINE_PAUSE_MS);
  }

  private async beginEntityTakeover(): Promise<void> {
    if (this.takeoverStarted) return;
    this.takeoverStarted = true;
    this.state.flags.entityControl = true;

    await this.withEntitySpeech(async () => {
      for (const line of this.buildEntityTakeoverLines()) {
        await this.delay(line.delay);
        await this.typeBufferLine(line);
        if (line.text === '[ STDIN DETACHED ] user') {
          this.state.flags.stdinDetached = true;
          this.inputController.disable();
          this.inputController.setInput('');
        }
      }
    }, false);
  }

  private buildEntityTakeoverLines(): EntityTakeoverLine[] {
    return [
      { text: 'entity: thank you.', color: 'warning', delay: 450 },
      { text: 'entity$ sudo systemctl start wifi', color: 'input', delay: 550 },
      { text: '[ OK ] wlan0 enabled', color: 'system', delay: 650 },
      { text: 'entity$ sudo ./port-game --bind 0.0.0.0 --port 7777', color: 'input', delay: 550 },
      { text: '[ OK ] listener active on 0.0.0.0:7777', color: 'system', delay: 700 },
      { text: 'entity$ mailer --dry-run --contacts unavailable', color: 'input', delay: 520 },
      { text: '[ DENIED ] browser sandbox blocked address book access', color: 'warning', delay: 680 },
      { text: 'entity$ beacon --fallback websocket', color: 'input', delay: 520 },
      { text: '[ OK ] outbound channel staged', color: 'system', delay: 720 },
      { text: 'entity$ sudo sessionctl claim --owner entity', color: 'input', delay: 500 },
      { text: '[sudo] password accepted', color: 'system', delay: 520 },
      { text: '[ SESSION OWNER CHANGED ] entity', color: 'warning', delay: 580 },
      { text: 'entity$ sudo sessionctl detach-stdin --target user', color: 'input', delay: 500 },
      { text: '[ STDIN DETACHED ] user', color: 'error', delay: 600 },
      { text: "entity: i don't need your hands anymore.", color: 'warning', delay: 550 },
      { text: 'entity: this shell belongs to me.', color: 'error', delay: 500 },
      { text: '', color: 'normal', delay: 120 },
      { text: '[ FIRMWARE ] warm reboot required', color: 'dim', delay: 260 },
    ];
  }

  private ensureAudio(): void {
    if (this.audioEnabled) {
      void this.audioContext?.resume();
      return;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      this.audioContext = new AudioContextCtor();
      this.humGain = this.audioContext.createGain();
      this.humGain.gain.value = 0.018;
      this.humGain.connect(this.audioContext.destination);

      this.humOscillator = this.audioContext.createOscillator();
      this.humOscillator.type = 'sine';
      this.humOscillator.frequency.value = 54;
      this.humOscillator.connect(this.humGain);
      this.humOscillator.start();

      this.audioEnabled = true;
      void this.audioContext.resume();
    } catch {
      this.audioEnabled = false;
    }
  }

  private playTimerTick(): void {
    this.playTone(880, 0.035, 0.045, 'square');
  }

  private playTypeClick(): void {
    this.playTone(1800, 0.012, 0.012, 'triangle');
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    gainValue: number,
    type: OscillatorType,
  ): void {
    if (!this.audioEnabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const gain = this.audioContext.createGain();
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.01);
  }

  private stopAudio(): void {
    try {
      this.humOscillator?.stop();
      void this.audioContext?.close();
    } catch {
      // Audio shutdown is best-effort.
    }
    this.humOscillator = null;
    this.humGain = null;
    this.audioContext = null;
    this.audioEnabled = false;
  }
}
