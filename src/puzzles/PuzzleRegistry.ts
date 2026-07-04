import { PUZZLES } from '../data/puzzles.ts';
import type { PuzzleData } from '../data/puzzles.ts';
import { caesarDecrypt } from './crypto.ts';

export class PuzzleRegistry {
  private readonly puzzles: PuzzleData[] = PUZZLES;

  /** Find puzzle metadata by the absolute VFS path of its encrypted file. */
  findByFilePath(absolutePath: string): PuzzleData | null {
    return this.puzzles.find(p => p.filePath === absolutePath) ?? null;
  }

  /**
   * Attempt to decrypt a file.
   * Returns the decrypted text or null if the method is unsupported.
   */
  decrypt(content: string, method: string, key: number): string | null {
    if (method === 'caesar') return caesarDecrypt(content, key);
    return null;
  }

  /**
   * Check whether the supplied method + key correctly solve a puzzle.
   * Returns the PuzzleData if solved, null otherwise.
   */
  checkSolve(
    absoluteFilePath: string,
    method: string,
    key: number,
  ): PuzzleData | null {
    const puzzle = this.findByFilePath(absoluteFilePath);
    if (!puzzle) return null;
    if (puzzle.method === method && puzzle.key === key) return puzzle;
    return null;
  }

  /** Validate the player's submitted access code. */
  checkAnswer(code: string): PuzzleData | null {
    const upper = code.trim().toUpperCase();
    return this.puzzles.find(p => p.answerCode === upper) ?? null;
  }
}
