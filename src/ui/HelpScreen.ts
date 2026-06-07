function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

/**
 * A "How to Play" overlay — controls plus the core survival loop and goal.
 * Reachable from the title screen and via [H] in-game. Auto-shown once on a
 * first-time player's first New Game.
 */
export class HelpScreen {
  visible = false;
  onClose: () => void = () => {};
  private readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "help-panel hidden");
    this.root.innerHTML = `
      <h2>How to Play</h2>
      <p class="help-intro">You woke from a crashed escape pod on <b>Vaelun</b> — a living world that adapts to you. Stay alive, uncover what happened to the colony ship CALDERA, and decide how your story ends. There are no waypoints and no recipe books: you learn by <b>observing and experimenting</b>.</p>
      <div class="help-cols">
        <div>
          <h3>The loop</h3>
          <ul>
            <li><b>Gather</b> — aim at glowing nodes and hold <span class="k">E</span> (ore, fronds, food, water).</li>
            <li><b>Craft</b> — press <span class="k">Tab</span>; recipes reveal when you hold the right materials. Build a <b>Fabricator</b> to unlock more tiers.</li>
            <li><b>Survive</b> — eat &amp; drink from the hotbar; a <b>Fire Pit</b> gives warmth, a safe zone, and cooking.</li>
            <li><b>Build &amp; fortify</b> — press <span class="k">B</span> to place structures on the grid.</li>
            <li><b>Explore</b> — five biomes hold lore, crash sites, and the Cradle. Watch your <b>Veil Exposure</b>. Two endings await.</li>
          </ul>
        </div>
        <div>
          <h3>Controls</h3>
          <ul class="help-controls">
            <li>Move <span class="k">W A S D</span></li>
            <li>Sprint <span class="k">Shift</span> · Crouch <span class="k">Ctrl</span> · Jump <span class="k">Space</span></li>
            <li>Look <span class="k">Mouse</span> · Attack / use tool <span class="k">L-Click</span></li>
            <li>Interact / gather <span class="k">E</span> · Hotbar <span class="k">1</span>–<span class="k">6</span></li>
            <li>Craft <span class="k">Tab</span> · Build <span class="k">B</span></li>
            <li>Survey Log <span class="k">J</span> · Settings <span class="k">O</span> · Help <span class="k">H</span></li>
            <li>Release mouse <span class="k">Esc</span> — click the screen to resume</li>
          </ul>
        </div>
      </div>
      <button class="help-close">Got it — let's survive</button>`;
    parent.appendChild(this.root);
    this.root.querySelector(".help-close")!.addEventListener("click", () => this.onClose());
  }

  open(): void {
    this.visible = true;
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.visible = false;
    this.root.classList.add("hidden");
  }
}
