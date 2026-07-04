export interface PuzzleData {
  id: string;
  /** Absolute path of the encrypted file in the VFS. */
  filePath: string;
  method: 'caesar';
  key: number;
  /** The plaintext access code the player must submit to win. */
  answerCode: string;
  solvedMessage: string[];
}

export const PUZZLES: PuzzleData[] = [
  {
    id: 'emergency_broadcast',
    filePath: '/logs/emergency.enc',
    method: 'caesar',
    key: 13,
    answerCode: 'NOVA-7734',
    solvedMessage: [
      '',
      '[DECRYPTION SUCCESSFUL]',
      'Access code identified: NOVA-7734',
      '',
      'Type  submit NOVA-7734  to restore navigation and escape.',
      '',
    ],
  },
];
