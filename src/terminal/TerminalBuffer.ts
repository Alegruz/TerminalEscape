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

  replaceAt(index: number, text: string, color: TextColor = 'normal'): void {
    if (index < 0 || index >= this.lines.length) return;
    this.lines[index] = { text, color };
  }

  removeAt(index: number): void {
    if (index < 0 || index >= this.lines.length) return;
    this.lines.splice(index, 1);
  }

  clear(): void {
    this.lines = [];
  }

  getLines(): readonly BufferLine[] {
    return this.lines;
  }

  get lineCount(): number {
    return this.lines.length;
  }

  /**
   * Return a visible window of lines.
   * `offsetFromBottom` is 0 at the newest output, 1 one line higher, etc.
   */
  getVisibleLines(count: number, offsetFromBottom = 0): BufferLine[] {
    const clampedOffset = Math.max(0, offsetFromBottom);
    const end = Math.max(0, this.lines.length - clampedOffset);
    const start = Math.max(0, end - count);
    return this.lines.slice(start, end);
  }
}
