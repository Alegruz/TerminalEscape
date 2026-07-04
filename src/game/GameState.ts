export class GameState {
  /** Lifecycle stage of the game. */
  stage: 'boot' | 'play' | 'complete' | 'failed' = 'boot';

  /** Epoch timestamp when the ship reaches the collision point. */
  missionEndsAt: number | null = null;

  /** Current working directory (absolute path). */
  currentPath: string = '/';

  /** History of submitted commands (newest last). */
  commandHistory: string[] = [];

  /** Index into commandHistory while navigating with ArrowUp/Down; -1 = not navigating. */
  historyIndex: number = -1;

  flags = {
    emergencyDecrypted: false,
    navUnlocked: false,
    navRepaired: false,
    endingReached: false,
    crashReached: false,
  };

  startMissionTimer(durationMs: number, now = Date.now()): void {
    this.missionEndsAt = now + durationMs;
  }

  getRemainingTimeMs(now = Date.now()): number | null {
    if (this.missionEndsAt === null) return null;
    return Math.max(0, this.missionEndsAt - now);
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
