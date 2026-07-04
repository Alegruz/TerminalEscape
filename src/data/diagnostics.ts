import type { TextColor } from '../style/theme.ts';

export type DiagnosticSeverity = 'info' | 'warn' | 'error' | 'critical';
export type SystemState = 'nominal' | 'degraded' | 'offline' | 'locked' | 'collision';

export interface DiagnosticLine {
  text: string;
  color: TextColor;
}

export interface ShipSystemDiagnostic {
  id: string;
  label: string;
  bootName: string;
  state: SystemState;
  severity: DiagnosticSeverity;
  cause: string;
  blocksEscape: boolean;
  repairedWhen: 'navUnlocked' | null;
}

export interface TimerEvent {
  thresholdMs: number;
  severity: DiagnosticSeverity;
  message: string;
}

export interface ShipDiagnosticsConfig {
  impactDurationMs: number;
  systems: ShipSystemDiagnostic[];
  timerStartMessage: string;
  timerEvents: TimerEvent[];
  failureLines: DiagnosticLine[];
}

export const SHIP_DIAGNOSTICS: ShipDiagnosticsConfig = {
  impactDurationMs: 8 * 60 * 1000,
  systems: [
    {
      id: 'nav',
      label: 'Navigation',
      bootName: 'Navigation subsystem',
      state: 'locked',
      severity: 'error',
      cause: 'authorization lockout after impact event',
      blocksEscape: true,
      repairedWhen: 'navUnlocked',
    },
    {
      id: 'trajectory',
      label: 'Trajectory',
      bootName: 'Trajectory projection',
      state: 'collision',
      severity: 'critical',
      cause: 'uncontrolled drift into debris field',
      blocksEscape: true,
      repairedWhen: 'navUnlocked',
    },
    {
      id: 'comms',
      label: 'Comms array',
      bootName: 'Comms array',
      state: 'degraded',
      severity: 'warn',
      cause: 'impact damage across external relay cluster',
      blocksEscape: false,
      repairedWhen: null,
    },
    {
      id: 'life-support',
      label: 'Life support',
      bootName: 'Life support',
      state: 'nominal',
      severity: 'info',
      cause: 'primary loop stable',
      blocksEscape: false,
      repairedWhen: null,
    },
  ],
  timerStartMessage: '[ TIMER ] Impact prediction window opened: {time}.',
  timerEvents: [
    {
      thresholdMs: 5 * 60 * 1000,
      severity: 'warn',
      message: 'Impact prediction T-05:00. Collision solution still unresolved.',
    },
    {
      thresholdMs: 2 * 60 * 1000,
      severity: 'error',
      message: 'Impact prediction T-02:00. Navigation remains locked.',
    },
    {
      thresholdMs: 1 * 60 * 1000,
      severity: 'error',
      message: 'Impact prediction T-01:00. Hull stress rising.',
    },
    {
      thresholdMs: 30 * 1000,
      severity: 'critical',
      message: 'Impact prediction T-00:30. Final correction window.',
    },
    {
      thresholdMs: 10 * 1000,
      severity: 'critical',
      message: 'Impact prediction T-00:10.',
    },
  ],
  failureLines: [
    { text: '', color: 'warning' },
    { text: '╔════════════════════════════════════════════╗', color: 'error' },
    { text: '║             IMPACT EVENT                   ║', color: 'error' },
    { text: '╠════════════════════════════════════════════╣', color: 'error' },
    { text: '║                                            ║', color: 'error' },
    { text: '║   Navigation lockout was not cleared.      ║', color: 'error' },
    { text: '║   ARES-7 has entered the debris field.     ║', color: 'error' },
    { text: '║                                            ║', color: 'error' },
    { text: '║              SHIP LOST                     ║', color: 'error' },
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

export function formatBootDiagnostic(system: ShipSystemDiagnostic): DiagnosticLine {
  const severity = severityLabel(system.severity);
  return {
    text: `[ ${severity.padEnd(5)}] ${system.bootName}: ${stateLabel(system.state)}`,
    color: severityColor(system.severity),
  };
}
