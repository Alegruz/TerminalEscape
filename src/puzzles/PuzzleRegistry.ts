import type { FSFileHeader, FSStateFlag } from '../data/filesystem.ts';
import type { VirtualFileSystem } from '../fs/VirtualFileSystem.ts';
import { caesarDecrypt } from './crypto.ts';

export interface PuzzleData {
  id: string;
  filePath: string;
  method: 'caesar';
  key: number;
  answerCode: string;
  solveFlag: FSStateFlag;
}

export class PuzzleRegistry {
  private readonly puzzles: PuzzleData[];

  constructor(vfs: VirtualFileSystem) {
    this.puzzles = vfs.findFilesByHeader((header) => header.puzzleId !== undefined)
      .map(({ path, header }) => this.createPuzzle(path, header));
  }

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

  /** Validate the player's access code. */
  checkAnswer(code: string): PuzzleData | null {
    const upper = code.trim().toUpperCase();
    return this.puzzles.find(p => p.answerCode === upper) ?? null;
  }

  private createPuzzle(filePath: string, header: FSFileHeader): PuzzleData {
    if (
      !header.puzzleId ||
      header.cipher !== 'caesar' ||
      header.key === undefined ||
      !header.answerCode ||
      !header.solveFlag
    ) {
      throw new Error(`Invalid puzzle header for ${filePath}`);
    }

    return {
      id: header.puzzleId,
      filePath,
      method: header.cipher,
      key: header.key,
      answerCode: header.answerCode.toUpperCase(),
      solveFlag: header.solveFlag,
    };
  }
}
