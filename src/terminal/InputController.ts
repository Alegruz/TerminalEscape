/**
 * Handles all keyboard input for the terminal.
 * Maintains the current input string + cursor position.
 * Delegates history navigation and tab-completion to callbacks.
 */
export class InputController {
  private _input: string = '';
  private _cursorPos: number = 0;
  private _selectionAnchor: number | null = null;
  /** True while the terminal is accepting user input. */
  private _enabled: boolean = false;
  /** True while Enter is allowed to submit the current input. */
  private _submitEnabled: boolean = true;

  private readonly onSubmit: (input: string) => void;
  private readonly onTab: (input: string) => void;
  private readonly onChange: () => void;
  private readonly onHistoryUp: () => string | null;
  private readonly onHistoryDown: () => string;

  constructor(
    onSubmit: (input: string) => void,
    onTab: (input: string) => void,
    onChange: () => void,
    onHistoryUp: () => string | null,
    onHistoryDown: () => string,
  ) {
    this.onSubmit = onSubmit;
    this.onTab = onTab;
    this.onChange = onChange;
    this.onHistoryUp = onHistoryUp;
    this.onHistoryDown = onHistoryDown;
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  get input(): string { return this._input; }
  get cursorPos(): number { return this._cursorPos; }
  get enabled(): boolean { return this._enabled; }
  get selectionStart(): number { return this.selectionRange()?.start ?? this._cursorPos; }
  get selectionEnd(): number { return this.selectionRange()?.end ?? this._cursorPos; }

  enable(): void  { this._enabled = true; }
  disable(): void { this._enabled = false; }
  enableSubmit(): void { this._submitEnabled = true; }
  disableSubmit(): void { this._submitEnabled = false; }

  /** Replace the current input (e.g. from history navigation or autocomplete). */
  setInput(value: string): void {
    this._input = value;
    this._cursorPos = value.length;
    this.clearSelection();
    this.onChange();
  }

  private selectionRange(): { start: number; end: number } | null {
    if (this._selectionAnchor === null || this._selectionAnchor === this._cursorPos) return null;
    return {
      start: Math.min(this._selectionAnchor, this._cursorPos),
      end: Math.max(this._selectionAnchor, this._cursorPos),
    };
  }

  private clearSelection(): void {
    this._selectionAnchor = null;
  }

  private moveCursor(nextPos: number, selecting: boolean): void {
    const clamped = Math.max(0, Math.min(this._input.length, nextPos));
    if (selecting && this._selectionAnchor === null) {
      this._selectionAnchor = this._cursorPos;
    }
    this._cursorPos = clamped;
    if (!selecting) this.clearSelection();
    if (this._selectionAnchor === this._cursorPos) this.clearSelection();
    this.onChange();
  }

  private replaceSelection(text: string): boolean {
    const range = this.selectionRange();
    if (range === null) return false;

    this._input = this._input.slice(0, range.start) + text + this._input.slice(range.end);
    this._cursorPos = range.start + text.length;
    this.clearSelection();
    this.onChange();
    return true;
  }

  private previousWordBoundary(): number {
    let pos = this._cursorPos;
    while (pos > 0 && /\s/.test(this._input[pos - 1])) pos--;
    while (pos > 0 && !/\s/.test(this._input[pos - 1])) pos--;
    return pos;
  }

  private nextWordBoundary(): number {
    let pos = this._cursorPos;
    while (pos < this._input.length && /\s/.test(this._input[pos])) pos++;
    while (pos < this._input.length && !/\s/.test(this._input[pos])) pos++;
    return pos;
  }

  // ── Key handling ─────────────────────────────────────────────────────────────

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this._enabled) return;

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        if (!this._submitEnabled) break;

        const cmd = this._input;
        this._input = '';
        this._cursorPos = 0;
        this.clearSelection();
        this.onChange();
        this.onSubmit(cmd);
        break;
      }

      case 'Backspace': {
        e.preventDefault();
        if (this.replaceSelection('')) {
          break;
        }
        if (e.ctrlKey) {
          const start = this.previousWordBoundary();
          if (start < this._cursorPos) {
            this._input = this._input.slice(0, start) + this._input.slice(this._cursorPos);
            this._cursorPos = start;
            this.clearSelection();
            this.onChange();
          }
        } else if (this._cursorPos > 0) {
          this._input =
            this._input.slice(0, this._cursorPos - 1) +
            this._input.slice(this._cursorPos);
          this._cursorPos--;
          this.clearSelection();
          this.onChange();
        }
        break;
      }

      case 'Delete': {
        e.preventDefault();
        if (this.replaceSelection('')) {
          break;
        }
        if (e.ctrlKey) {
          const end = this.nextWordBoundary();
          if (end > this._cursorPos) {
            this._input = this._input.slice(0, this._cursorPos) + this._input.slice(end);
            this.clearSelection();
            this.onChange();
          }
        } else if (this._cursorPos < this._input.length) {
          this._input =
            this._input.slice(0, this._cursorPos) +
            this._input.slice(this._cursorPos + 1);
          this.onChange();
        }
        break;
      }

      case 'ArrowLeft': {
        e.preventDefault();
        const range = this.selectionRange();
        const nextPos = !e.shiftKey && range !== null
          ? range.start
          : e.ctrlKey ? this.previousWordBoundary() : this._cursorPos - 1;
        if (nextPos >= 0 && nextPos !== this._cursorPos) {
          this.moveCursor(nextPos, e.shiftKey);
        } else if (!e.shiftKey) {
          this.clearSelection();
          this.onChange();
        }
        break;
      }

      case 'ArrowRight': {
        e.preventDefault();
        const range = this.selectionRange();
        const nextPos = !e.shiftKey && range !== null
          ? range.end
          : e.ctrlKey ? this.nextWordBoundary() : this._cursorPos + 1;
        if (nextPos <= this._input.length && nextPos !== this._cursorPos) {
          this.moveCursor(nextPos, e.shiftKey);
        } else if (!e.shiftKey) {
          this.clearSelection();
          this.onChange();
        }
        break;
      }

      case 'Home': {
        e.preventDefault();
        this.moveCursor(0, e.shiftKey);
        break;
      }

      case 'End': {
        e.preventDefault();
        this.moveCursor(this._input.length, e.shiftKey);
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        const prev = this.onHistoryUp();
        if (prev !== null) this.setInput(prev);
        break;
      }

      case 'ArrowDown': {
        e.preventDefault();
        const next = this.onHistoryDown();
        this.setInput(next);
        break;
      }

      case 'Tab': {
        e.preventDefault();
        // Tab is a terminal control key here; it never inserts a literal tab.
        this.onTab(this._input);
        break;
      }

      default: {
        // Printable characters only.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (!this.replaceSelection(e.key)) {
            this._input =
              this._input.slice(0, this._cursorPos) +
              e.key +
              this._input.slice(this._cursorPos);
            this._cursorPos++;
            this.clearSelection();
            this.onChange();
          }
        }
        break;
      }
    }
  }
}
