export type FSFile = {
  type: 'file';
  content: string;
};

export type FSDir = {
  type: 'dir';
  children: Record<string, FSFile | FSDir>;
};

export type FSNode = FSFile | FSDir;

export const ROOT_FS: FSDir = {
  type: 'dir',
  children: {
    'readme.txt': {
      type: 'file',
      content: `ARES-7 MAINTENANCE TERMINAL  v4.1.0
====================================
Ship status : CRITICAL
Life support: NOMINAL
Navigation  : OFFLINE
Comms array : DAMAGED

Multiple system failures detected after impact event.

RECOMMENDED ACTIONS:
  1. Review emergency logs  ->  cd /logs
  2. Analyze encrypted file ->  analyze emergency.enc
  3. Decrypt transmission   ->  decrypt --method caesar --key ? emergency.enc
  4. Restore navigation     ->  submit <access-code>

Run 'status' at any time for current objectives.
Run 'help' for a full list of commands.
`,
    },
    logs: {
      type: 'dir',
      children: {
        'crew_note.txt': {
          type: 'file',
          content: `Personal Log — Chief Engineer Vasquez
Day 47.

The emergency broadcast encryption uses the default protocol.
I always told Command that ROT13 is too simple, but protocol
is protocol.  Key 13.  Caesar cipher.  That's it.

If you're reading this: decode the emergency log to retrieve
the navigation unlock code.  Then use 'submit <code>'.

Good luck.
— V
`,
        },
        'emergency.enc': {
          type: 'file',
          content: `== RZRETRAPL OEBNQPNFG ==
FUVC: NERF-7
FGNGHF: PEVGVPNY SNVYHER
ANIVTNGVBA FLFGRZ: BSSYVAR
RFPNCR CBQ NPPRFF PBQR: ABIN-7734
NHGUBEVMNGVBA: PZQ-PUVRS INFDHRM

NPGVBA ERDHVERQ: ERNPGVINGR ANIVTNGVBA
RAGRE NPPRFF PBQR NG FLFGRZF GREZVANY
`,
        },
      },
    },
    systems: {
      type: 'dir',
      children: {
        'nav.locked': {
          type: 'file',
          content: `NAVIGATION SYSTEM — ACCESS RESTRICTED
======================================
Status        : LOCKED
Authorization : REQUIRED

To restore navigation, provide the access code:

  submit <code>

Hint: Decrypt /logs/emergency.enc to obtain the code.
      Use 'analyze emergency.enc' for cipher details.
`,
        },
        'nav_core.dat': {
          type: 'file',
          content: `[NAVIGATION CORE — RESTRICTED]
Last known position : Sector 7, Grid 4-Alpha
Destination         : Earth Station Meridian
Original ETA        : 14 days

** AUTHORIZATION REQUIRED BEFORE ACCESS **
`,
        },
      },
    },
  },
};
