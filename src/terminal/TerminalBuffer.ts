import type { TextColor } from '../style/theme.ts';

export interface BufferLine {
  text: string;
  color: TextColor;
}

export class TerminalBuffer {
  private lines: BufferLine[] = [];
  private readonly maxLines: number;

  constructor(maxLines = 600) {
    this.maxLines = maxLines;
  }

  /** Add one or more lines (splits on '\n'). */
  push(text: string, color: TextColor = 'normal'): void {
    for (const line of text.split('\n')) {
      this.lines.push({ text: line, color });
      if (this.lines.length > this.maxLines) this.lines.shift();
    }
  }

  /** Add multiple pre-built lines. */
  pushLines(lines: BufferLine[]): void {
    for (const l of lines) this.push(l.text, l.color);
  }

  clear(): void {
    this.lines = [];
  }

  getLines(): readonly BufferLine[] {
    return this.lines;
  }

  /** Return the last `count` lines, or all lines if fewer exist. */
  getVisibleLines(count: number): BufferLine[] {
    const start = Math.max(0, this.lines.length - count);
    return this.lines.slice(start);
  }
}
