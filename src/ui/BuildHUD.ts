import { getItem } from "../data/items";

export interface BuildHudState {
  name: string;
  cost: { name: string; have: number; need: number; ok: boolean }[];
  valid: boolean;
  reason: string;
}

/** Heads-up panel shown while in build mode (GDD §13.3 Build Mode). */
export class BuildHUD {
  private readonly root: HTMLDivElement;
  private readonly moduleEl: HTMLDivElement;
  private readonly costEl: HTMLDivElement;
  private readonly statusEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "build-hud hidden";
    this.root.innerHTML = `
      <div class="bh-title">BUILD MODE</div>
      <div class="bh-module"></div>
      <div class="bh-cost"></div>
      <div class="bh-status"></div>
      <div class="bh-controls">
        <span>Wheel / Q · E</span> cycle &nbsp; <span>R</span> rotate &nbsp;
        <span>LMB</span> place &nbsp; <span>B</span> exit
      </div>`;
    parent.appendChild(this.root);
    this.moduleEl = this.root.querySelector(".bh-module")!;
    this.costEl = this.root.querySelector(".bh-cost")!;
    this.statusEl = this.root.querySelector(".bh-status")!;
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  update(s: BuildHudState): void {
    this.moduleEl.textContent = s.name;
    this.costEl.innerHTML = s.cost
      .map(
        (c) =>
          `<span class="ing ${c.ok ? "ok" : "no"}">${getItem(c.name).name} ${c.have}/${c.need}</span>`,
      )
      .join(" · ");
    this.statusEl.textContent = s.reason;
    this.statusEl.className = `bh-status ${s.valid ? "ok" : "no"}`;
  }
}
