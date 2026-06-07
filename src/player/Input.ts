/**
 * Keyboard + pointer-lock mouse input. Tracks held keys, per-frame "just
 * pressed" edges, and accumulated mouse delta while the pointer is locked.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly justPressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheelDelta = 0;
  locked = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!e.repeat) this.justPressed.add(e.code);
      this.down.add(e.code);
      // Tab must never move DOM focus (it toggles the panel); Space must not
      // scroll the page while the pointer is locked.
      if (e.code === "Tab" || (this.locked && e.code === "Space")) {
        e.preventDefault();
      }
      // During an active (pointer-locked) run, suppress the page-level shortcuts
      // the browser still lets a page cancel, so a stray keypress doesn't reload,
      // print, or save-page mid-game. Browser-reserved combos (Ctrl+W/T/N) can't
      // be blocked by any page — the Game's beforeunload guard prompts on those.
      if (
        this.locked &&
        (e.code === "F5" ||
          ((e.ctrlKey || e.metaKey) &&
            (e.code === "KeyR" || e.code === "KeyS" || e.code === "KeyP" || e.code === "KeyW")))
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    window.addEventListener("mousedown", (e) => {
      this.justPressed.add(`Mouse${e.button}`);
      this.down.add(`Mouse${e.button}`);
    });
    window.addEventListener("mouseup", (e) => this.down.delete(`Mouse${e.button}`));

    window.addEventListener(
      "wheel",
      (e) => {
        if (!this.locked) return;
        this.wheelDelta += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.down.clear();
    });
  }

  requestLock(): void {
    if (this.locked) return;
    // Chrome enforces a short cooldown after an Esc-exit during which this
    // rejects; swallow it (the next click re-locks) so it isn't an uncaught error.
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  /** Returns accumulated mouse delta since last call and resets it. */
  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** Returns and clears accumulated wheel direction (-1 up, +1 down, 0 none). */
  consumeWheel(): number {
    const d = Math.sign(this.wheelDelta);
    this.wheelDelta = 0;
    return d;
  }

  /** Call at the very end of each frame to clear edge state. */
  endFrame(): void {
    this.justPressed.clear();
  }
}
