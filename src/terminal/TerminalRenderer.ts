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
  private instability = 0;
  private instabilityTimeMs = 0;
  private glitchHoldMs = 0;
  private lineJitter: number[] = Array(MAX_OUTPUT_LINES).fill(0);

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
  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

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
    this.refreshChrome();

    this.app.ticker.add(this.tick.bind(this));
    window.addEventListener('resize', () => {
      requestAnimationFrame(() => this.refreshChrome());
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
    this.refreshChromeIfScreenChanged();

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

    this.updateInstability(ticker.deltaMS);
  }

  markDirty(): void {
    this.dirty = true;
  }

  private refreshChromeIfScreenChanged(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    if (width === this.lastScreenWidth && height === this.lastScreenHeight) return;

    this.refreshChrome();
  }

  private refreshChrome(): void {
    this.lastScreenWidth = this.app.screen.width;
    this.lastScreenHeight = this.app.screen.height;
    this.drawBorder();
    this.buildScanlines();
    this.markDirty();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  render(
    visibleLines: BufferLine[],
    inputValue: string,
    cursorPos: number,
    inputEnabled: boolean,
    statusLine: string,
    prompt: string,
    instability: number = 0,
  ): void {
    const normalizedInstability = Math.min(1, Math.max(0, instability));
    // Check for actual changes before marking dirty.
    const changed =
      visibleLines.length !== this.lastLines.length ||
      visibleLines.some((l, i) => l !== this.lastLines[i]) ||
      inputValue !== this.lastInput ||
      cursorPos !== this.lastCursorPos ||
      statusLine !== this.lastStatusLine ||
      prompt !== this.lastPrompt ||
      normalizedInstability !== this.instability;

    if (changed) {
      this.lastLines = visibleLines;
      this.lastInput = inputValue;
      this.lastCursorPos = cursorPos;
      this.lastStatusLine = statusLine;
      this.lastPrompt = prompt;
      this.instability = normalizedInstability;
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

  private updateInstability(deltaMs: number): void {
    if (this.instability <= 0) {
      this.resetInstabilityOffsets();
      return;
    }

    this.instabilityTimeMs += deltaMs;
    this.glitchHoldMs -= deltaMs;
    if (this.glitchHoldMs <= 0) {
      this.glitchHoldMs = 40 + Math.random() * Math.max(120, 220 - this.instability * 160);
      this.refreshLineJitter();
    }

    const pulse = Math.sin(this.instabilityTimeMs * 0.045) * this.instability;
    const shakeX = this.randomSigned(THEME.maxShakeX * this.instability) + pulse * 1.5;
    const shakeY = this.randomSigned(THEME.maxShakeY * this.instability);
    const textAlpha = 1 - Math.random() * THEME.textFlickerAlpha * this.instability;

    this.outputContainer.x = shakeX;
    this.outputContainer.y = shakeY;
    this.outputContainer.alpha = textAlpha;

    for (let i = 0; i < this.outputTexts.length; i++) {
      const textObj = this.outputTexts[i];
      textObj.x = THEME.paddingX + this.lineJitter[i] * this.instability;
      textObj.y = THEME.paddingTop + i * THEME.lineHeight + this.randomSigned(0.4 * this.instability);
    }

    this.statusText.x = THEME.paddingX + shakeX + this.randomSigned(2 * this.instability);
    this.inputText.x = THEME.paddingX + shakeX;
    this.cursorGraphic.x = shakeX;
    this.cursorGraphic.y = shakeY;
    this.scanlineGraphic.alpha = 1 + Math.random() * THEME.scanlineFlickerAlpha * this.instability;
    this.borderGraphic.alpha = 1 - Math.random() * THEME.borderFlickerAlpha * this.instability;
  }

  private refreshLineJitter(): void {
    const chance = THEME.lineGlitchChance * this.instability;
    for (let i = 0; i < this.lineJitter.length; i++) {
      this.lineJitter[i] = Math.random() < chance
        ? this.randomSigned(THEME.maxLineJitterX)
        : 0;
    }
  }

  private resetInstabilityOffsets(): void {
    if (
      this.outputContainer.x === 0 &&
      this.outputContainer.y === 0 &&
      this.outputContainer.alpha === 1 &&
      this.scanlineGraphic.alpha === 1 &&
      this.borderGraphic.alpha === 1
    ) {
      return;
    }

    this.outputContainer.x = 0;
    this.outputContainer.y = 0;
    this.outputContainer.alpha = 1;
    for (let i = 0; i < this.outputTexts.length; i++) {
      this.outputTexts[i].x = THEME.paddingX;
      this.outputTexts[i].y = THEME.paddingTop + i * THEME.lineHeight;
    }
    this.statusText.x = THEME.paddingX;
    this.inputText.x = THEME.paddingX;
    this.cursorGraphic.x = 0;
    this.cursorGraphic.y = 0;
    this.scanlineGraphic.alpha = 1;
    this.borderGraphic.alpha = 1;
  }

  private randomSigned(amount: number): number {
    return (Math.random() * 2 - 1) * amount;
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
