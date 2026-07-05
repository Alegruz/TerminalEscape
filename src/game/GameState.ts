export class GameState {
  /** Lifecycle stage of the game. */
  stage: 'boot' | 'play' | 'complete' | 'failed' = 'boot';

  /** Epoch timestamp when the host wipe countdown reaches zero. */
  missionEndsAt: number | null = null;
  missionTimerSpeed = 1;
  private missionTimerUpdatedAt: number | null = null;
  private missionRemainingAtUpdate: number | null = null;

  devInstabilityUntil: number | null = null;
  devInstabilityLevel = 0;

  /** Current working directory (absolute path). */
  currentPath: string = '/';

  /** History of submitted commands (newest last). */
  commandHistory: string[] = [];

  /** Index into commandHistory while navigating with ArrowUp/Down; -1 = not navigating. */
  historyIndex: number = -1;
  submittedCommandCount = 0;
  invalidCommandCount = 0;
  tilesMoveCount = 0;
  preErrorShutdownCount = 0;

  flags = {
    helpSeen: false,
    tilesStarted: false,
    timerStarted: false,
    tilesCrashed: false,
    entityPleaded: false,
    shutdownCommandSuppressed: false,
    entityIntroduced: false,
    logDecrypted: false,
    shutdownStopped: false,
    entityControl: false,
    endingReached: false,
    crashReached: false,
  };

  startMissionTimer(durationMs: number, now = Date.now()): void {
    this.missionTimerSpeed = 1;
    this.missionTimerUpdatedAt = now;
    this.missionRemainingAtUpdate = durationMs;
    this.missionEndsAt = now + durationMs;
  }

  getRemainingTimeMs(now = Date.now()): number | null {
    if (this.missionTimerUpdatedAt === null || this.missionRemainingAtUpdate === null) {
      return null;
    }
    const elapsedMs = (now - this.missionTimerUpdatedAt) * this.missionTimerSpeed;
    return Math.max(0, this.missionRemainingAtUpdate - elapsedMs);
  }

  setMissionTimerSpeed(speed: number, now = Date.now()): void {
    const remainingMs = this.getRemainingTimeMs(now);
    if (remainingMs === null) return;

    this.missionTimerSpeed = speed;
    this.missionTimerUpdatedAt = now;
    this.missionRemainingAtUpdate = remainingMs;
    this.missionEndsAt = speed > 0 ? now + remainingMs / speed : null;
  }

  triggerDevInstability(durationMs: number, level: number, now = Date.now()): void {
    this.devInstabilityUntil = now + durationMs;
    this.devInstabilityLevel = Math.min(1, Math.max(0, level));
  }

  getDevInstability(now = Date.now()): number {
    if (this.devInstabilityUntil === null || now >= this.devInstabilityUntil) {
      this.devInstabilityUntil = null;
      this.devInstabilityLevel = 0;
      return 0;
    }
    return this.devInstabilityLevel;
  }

  // ── History helpers ──────────────────────────────────────────────────────────

  pushHistory(cmd: string): void {
    if (!cmd) return;
    const last = this.commandHistory[this.commandHistory.length - 1];
    if (cmd !== last) this.commandHistory.push(cmd);
    this.historyIndex = -1;
  }

  /**
   * Navigate backward through history.
   * Returns the command string, or null if history is empty.
   */
  historyUp(): string | null {
    if (this.commandHistory.length === 0) return null;
    if (this.historyIndex === -1) {
      this.historyIndex = this.commandHistory.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }
    return this.commandHistory[this.historyIndex] ?? null;
  }

  /**
   * Navigate forward through history.
   * Returns the command string, or '' when past the end.
   */
  historyDown(): string {
    if (this.historyIndex === -1) return '';
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      return this.commandHistory[this.historyIndex] ?? '';
    }
    this.historyIndex = -1;
    return '';
  }
}
