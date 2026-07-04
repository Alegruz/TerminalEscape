import {
  Application,
  Text,
  TextStyle,
  Graphics,
  Container,
  CanvasTextMetrics,
} from 'pixi.js';
import { THEME, colorForType } from '../style/theme.ts';
import type { BufferLine } from './TerminalBuffer.ts';

/** Max visible text lines (excluding the input row). */
const MAX_OUTPUT_LINES = 36;

export class TerminalRenderer {
  private app!: Application;
  private outputContainer!: Container;
  private outputTexts: Text[] = [];
  private statusText!: Text;
  private inputText!: Text;
  private cursorGraphic!: Graphics;
  private scanlineGraphic!: Graphics;
  private borderGraphic!: Graphics;

  /** Controls cursor blink animation. */
  private cursorVisible = true;
  private cursorTimer = 0;
  private readonly cursorBlinkMs = 530;

  /** Dirty flag — avoids re-rendering text every frame. */
  private dirty = true;

  /** Snapshot of last rendered state for diff. */
  private lastLines: BufferLine[] = [];
  private lastInput = '';
  private lastCursorPos = -1;
  private lastStatusLine = '';
  private lastPrompt = '';

  async init(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: THEME.bg,
      resizeTo: window,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    const appEl = document.getElementById('app');
    (appEl ?? document.body).appendChild(this.app.canvas);

    this.buildSceneGraph();
    this.drawBorder();
    this.buildScanlines();

    this.app.ticker.add(this.tick.bind(this));
    window.addEventListener('resize', () => {
      this.drawBorder();
      this.buildScanlines();
      this.markDirty();
    });
  }

  // ── Scene construction ───────────────────────────────────────────────────────

  private buildSceneGraph(): void {
    // Border/panel (behind everything).
    this.borderGraphic = new Graphics();
    this.app.stage.addChild(this.borderGraphic);

    // Output text lines.
    this.outputContainer = new Container();
    this.app.stage.addChild(this.outputContainer);

    const baseStyle = new TextStyle({
      fontFamily: THEME.fontFamily,
      fontSize: THEME.fontSize,
      fill: THEME.textNormal,
      letterSpacing: 0.5,
    });

    for (let i = 0; i < MAX_OUTPUT_LINES; i++) {
      const t = new Text({ text: '', style: baseStyle.clone() });
      t.x = THEME.paddingX;
      t.y = THEME.paddingTop + i * THEME.lineHeight;
      this.outputContainer.addChild(t);
      this.outputTexts.push(t);
    }

    this.statusText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: THEME.fontFamily,
        fontSize: THEME.fontSize,
        fill: THEME.textWarning,
        letterSpacing: 0.5,
      }),
    });
    this.app.stage.addChild(this.statusText);

    // Input / prompt line.
    this.inputText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: THEME.fontFamily,
        fontSize: THEME.fontSize,
        fill: THEME.textInput,
        letterSpacing: 0.5,
      }),
    });
    this.app.stage.addChild(this.inputText);

    // Cursor block.
    this.cursorGraphic = new Graphics();
    this.app.stage.addChild(this.cursorGraphic);

    // Scanlines overlay (on top of everything).
    this.scanlineGraphic = new Graphics();
    this.app.stage.addChild(this.scanlineGraphic);
  }

  private drawBorder(): void {
    const g = this.borderGraphic;
    g.clear();
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    // Subtle inner glow border.
    g.rect(1, 1, w - 2, h - 2)
      .stroke({ color: 0x006622, alpha: 0.7, width: 1 });
    g.rect(3, 3, w - 6, h - 6)
      .stroke({ color: 0x004416, alpha: 0.4, width: 1 });
  }

  private buildScanlines(): void {
    const g = this.scanlineGraphic;
    g.clear();
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    for (let y = 0; y < h; y += 4) {
      g.moveTo(0, y).lineTo(w, y)
        .stroke({ color: THEME.scanlineColor, alpha: THEME.scanlineAlpha, width: 1 });
    }
    // Vignette-style darker corners (simple rect overlay).
    g.rect(0, 0, w, h)
      .fill({ color: 0x000000, alpha: 0.06 });
  }

  // ── Update loop ──────────────────────────────────────────────────────────────

  private tick(ticker: { deltaMS: number }): void {
    this.cursorTimer += ticker.deltaMS;
    if (this.cursorTimer >= this.cursorBlinkMs) {
      this.cursorTimer = 0;
      this.cursorVisible = !this.cursorVisible;
      this.dirty = true;
    }

    if (this.dirty) {
      this.repaint();
      this.dirty = false;
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  render(
    visibleLines: BufferLine[],
    inputValue: string,
    cursorPos: number,
    inputEnabled: boolean,
    statusLine: string,
    prompt: string,
  ): void {
    // Check for actual changes before marking dirty.
    const changed =
      visibleLines.length !== this.lastLines.length ||
      visibleLines.some((l, i) => l !== this.lastLines[i]) ||
      inputValue !== this.lastInput ||
      cursorPos !== this.lastCursorPos ||
      statusLine !== this.lastStatusLine ||
      prompt !== this.lastPrompt;

    if (changed) {
      this.lastLines = visibleLines;
      this.lastInput = inputValue;
      this.lastCursorPos = cursorPos;
      this.lastStatusLine = statusLine;
      this.lastPrompt = prompt;
      this.markDirty();
    }

    // Store for repaint; actual draw happens in tick().
    this._pendingLines = visibleLines;
    this._pendingInput = inputValue;
    this._pendingCursorPos = cursorPos;
    this._pendingInputEnabled = inputEnabled;
    this._pendingStatusLine = statusLine;
    this._pendingPrompt = prompt;
  }

  private _pendingLines: BufferLine[] = [];
  private _pendingInput: string = '';
  private _pendingCursorPos: number = 0;
  private _pendingInputEnabled: boolean = false;
  private _pendingStatusLine: string = '';
  private _pendingPrompt: string = '';

  private repaint(): void {
    const lines = this._pendingLines;
    const inputValue = this._pendingInput;
    const cursorPos = this._pendingCursorPos;
    const inputEnabled = this._pendingInputEnabled;
    const statusLine = this._pendingStatusLine;
    const prompt = this._pendingPrompt;

    // Output lines.
    for (let i = 0; i < MAX_OUTPUT_LINES; i++) {
      const textObj = this.outputTexts[i];
      const line = lines[i];
      if (line) {
        textObj.text = line.text;
        (textObj.style as TextStyle).fill = colorForType(line.color);
      } else {
        textObj.text = '';
      }
    }

    // Input / prompt line at the bottom of the canvas.
    const inputY =
      this.app.screen.height - THEME.paddingBottom;
    const statusY = inputY - THEME.lineHeight;

    this.statusText.text = statusLine;
    this.statusText.x = THEME.paddingX;
    this.statusText.y = statusY;

    const promptText = inputEnabled ? prompt + inputValue : '';
    this.inputText.text = promptText;
    this.inputText.x = THEME.paddingX;
    this.inputText.y = inputY;

    // Cursor block.
    this.cursorGraphic.clear();
    if (inputEnabled && this.cursorVisible) {
      const beforeCursor = prompt + inputValue.slice(0, cursorPos);
      const cursorWidth = this.getCursorWidth();
      const cursorX = THEME.paddingX + this.measureInputTextWidth(beforeCursor);
      const cursorH = THEME.fontSize + 2;
      const cursorY = inputY + (THEME.lineHeight - cursorH) / 2;
      this.cursorGraphic
        .rect(cursorX, cursorY, cursorWidth, cursorH)
        .fill({ color: THEME.cursorColor, alpha: 0.9 });
    }
  }

  private _cursorWidth: number | null = null;

  private getCursorWidth(): number {
    if (this._cursorWidth === null) {
      this._cursorWidth = Math.ceil(this.measureInputTextWidth('M'));
    }
    return this._cursorWidth;
  }

  private measureInputTextWidth(text: string): number {
    if (!text) return 0;
    const metrics = CanvasTextMetrics.measureText(text, this.inputText.style as TextStyle);
    return metrics.width;
  }

  // ── Boot helpers ─────────────────────────────────────────────────────────────

  get screenWidth(): number  { return this.app.screen.width; }
  get screenHeight(): number { return this.app.screen.height; }
}
