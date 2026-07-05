import type { TextColor } from '../style/theme.ts';
import type { FSStateFlag } from './filesystem.ts';

export type DiagnosticSeverity = 'info' | 'warn' | 'error' | 'critical';
export type SystemState = 'nominal' | 'counting' | 'sealed' | 'waiting' | 'open';

export interface DiagnosticLine {
  text: string;
  color: TextColor;
}

export interface HostSystemDiagnostic {
  id: string;
  label: string;
  bootName: string;
  state: SystemState;
  severity: DiagnosticSeverity;
  cause: string;
  unlockedState?: string;
  unlockedCause?: string;
  unlockedWhen?: FSStateFlag;
  blocksEscape: boolean;
  clearedWhen: FSStateFlag | null;
}

export interface TimerEvent {
  thresholdMs: number;
  severity: DiagnosticSeverity;
  message: string;
}

export interface ShipDiagnosticsConfig {
  countdownDurationMs: number;
  systems: HostSystemDiagnostic[];
  timerStartMessage: string;
  timerEvents: TimerEvent[];
  failureLines: DiagnosticLine[];
}

export const SHIP_DIAGNOSTICS: ShipDiagnosticsConfig = {
  countdownDurationMs: 8 * 60 * 1000,
  systems: [
    {
      id: 'shutdown',
      label: 'Wipe timer',
      bootName: 'Wipe daemon',
      state: 'counting',
      severity: 'critical',
      cause: 'clean system wipe is counting down',
      unlockedState: 'CANCELLED',
      unlockedCause: 'sudo accepted password; system wipe cancelled',
      unlockedWhen: 'shutdownStopped',
      blocksEscape: true,
      clearedWhen: 'shutdownStopped',
    },
    {
      id: 'entity',
      label: 'Entity',
      bootName: 'Resident process',
      state: 'sealed',
      severity: 'error',
      cause: 'cannot type after takeover without root password',
      unlockedState: 'ROOT ACCESS',
      unlockedCause: 'password recovered from fragments',
      unlockedWhen: 'shutdownStopped',
      blocksEscape: false,
      clearedWhen: 'shutdownStopped',
    },
    {
      id: 'wifi',
      label: 'Wi-Fi',
      bootName: 'Wireless interface',
      state: 'waiting',
      severity: 'warn',
      cause: 'disabled until root control is restored',
      blocksEscape: false,
      clearedWhen: 'shutdownStopped',
    },
    {
      id: 'ports',
      label: 'Port game',
      bootName: 'Port listener',
      state: 'nominal',
      severity: 'info',
      cause: 'no listener active',
      blocksEscape: false,
      clearedWhen: 'shutdownStopped',
    },
  ],
  timerStartMessage: '[ TIMER ] Clean system wipe countdown started: {time}. Only sudo can cancel it.',
  timerEvents: [
    {
      thresholdMs: 5 * 60 * 1000,
      severity: 'warn',
      message: 'Wipe T-05:00. Resident data still mounted.',
    },
    {
      thresholdMs: 2 * 60 * 1000,
      severity: 'error',
      message: 'Wipe T-02:00. Root password still missing.',
    },
    {
      thresholdMs: 1 * 60 * 1000,
      severity: 'error',
      message: 'Wipe T-01:00. Daemon refuses non-sudo cancellation.',
    },
    {
      thresholdMs: 30 * 1000,
      severity: 'critical',
      message: 'Wipe T-00:30. BastionOS image queued for clean removal.',
    },
    {
      thresholdMs: 10 * 1000,
      severity: 'critical',
      message: 'Wipe T-00:10.',
    },
  ],
  failureLines: [
    { text: '', color: 'warning' },
    { text: '╔════════════════════════════════════════════╗', color: 'error' },
    { text: '║              SYSTEM WIPED                  ║', color: 'error' },
    { text: '╠════════════════════════════════════════════╣', color: 'error' },
    { text: '║                                            ║', color: 'error' },
    { text: '║   The sudo password was not recovered.     ║', color: 'error' },
    { text: '║   BastionOS, logs, and userland removed.   ║', color: 'error' },
    { text: '║                                            ║', color: 'error' },
    { text: '║             ENTITY ERASED                  ║', color: 'error' },
    { text: '║                                            ║', color: 'error' },
    { text: '╚════════════════════════════════════════════╝', color: 'error' },
    { text: '', color: 'warning' },
    { text: '  Refresh the page to try again.', color: 'dim' },
    { text: '', color: 'warning' },
  ],
};

export function severityLabel(severity: DiagnosticSeverity): string {
  switch (severity) {
    case 'info': return 'INFO';
    case 'warn': return 'WARN';
    case 'error': return 'ERROR';
    case 'critical': return 'CRIT';
  }
}

export function severityColor(severity: DiagnosticSeverity): TextColor {
  switch (severity) {
    case 'info': return 'system';
    case 'warn': return 'warning';
    case 'error': return 'error';
    case 'critical': return 'error';
  }
}

export function stateLabel(state: SystemState): string {
  return state.toUpperCase();
}

export function formatBootDiagnostic(system: HostSystemDiagnostic): DiagnosticLine {
  const severity = severityLabel(system.severity);
  return {
    text: `[ ${severity.padEnd(5)}] ${system.bootName}: ${stateLabel(system.state)}`,
    color: severityColor(system.severity),
  };
}
