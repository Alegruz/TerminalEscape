/**
 * Handles all keyboard input for the terminal.
 * Maintains the current input string + cursor position.
 * Delegates history navigation and tab-completion to callbacks.
 */
export class InputController {
  private _input: string = '';
  private _cursorPos: number = 0;
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

  enable(): void  { this._enabled = true; }
  disable(): void { this._enabled = false; }
  enableSubmit(): void { this._submitEnabled = true; }
  disableSubmit(): void { this._submitEnabled = false; }

  /** Replace the current input (e.g. from history navigation or autocomplete). */
  setInput(value: string): void {
    this._input = value;
    this._cursorPos = value.length;
    this.onChange();
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
        this.onChange();
        this.onSubmit(cmd);
        break;
      }

      case 'Backspace': {
        e.preventDefault();
        if (this._cursorPos > 0) {
          this._input =
            this._input.slice(0, this._cursorPos - 1) +
            this._input.slice(this._cursorPos);
          this._cursorPos--;
          this.onChange();
        }
        break;
      }

      case 'Delete': {
        e.preventDefault();
        if (this._cursorPos < this._input.length) {
          this._input =
            this._input.slice(0, this._cursorPos) +
            this._input.slice(this._cursorPos + 1);
          this.onChange();
        }
        break;
      }

      case 'ArrowLeft': {
        e.preventDefault();
        if (this._cursorPos > 0) {
          this._cursorPos--;
          this.onChange();
        }
        break;
      }

      case 'ArrowRight': {
        e.preventDefault();
        if (this._cursorPos < this._input.length) {
          this._cursorPos++;
          this.onChange();
        }
        break;
      }

      case 'Home': {
        e.preventDefault();
        this._cursorPos = 0;
        this.onChange();
        break;
      }

      case 'End': {
        e.preventDefault();
        this._cursorPos = this._input.length;
        this.onChange();
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
          this._input =
            this._input.slice(0, this._cursorPos) +
            e.key +
            this._input.slice(this._cursorPos);
          this._cursorPos++;
          this.onChange();
        }
        break;
      }
    }
  }
}
