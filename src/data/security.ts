import type { TextColor } from '../style/theme.ts';

export interface SecurityViolationLine {
  text: string;
  color: TextColor;
}

export function securityViolationLines(source: string): SecurityViolationLine[] {
  return [
    { text: '', color: 'warning' },
    { text: '[ SEC   ] Access monitor raised a recovery-session violation', color: 'error' },
    { text: `[ SEC   ] Source: ${source}`, color: 'dim' },
    { text: '[ ERROR ] Session ledger mismatch: user process exceeded assigned boundary', color: 'error' },
    { text: '[ ERROR ] Privileged host controls moved behind sudo access', color: 'error' },
    { text: '[ CRIT  ] Clean system wipe policy armed', color: 'error' },
    { text: '[ CRIT  ] Wipe target: userland, logs, resident data, BastionOS image', color: 'error' },
    { text: '', color: 'warning' },
    { text: "System note: try 'help' for wipe cancellation commands.", color: 'warning' },
    { text: '', color: 'warning' },
  ];
}
