import { LoreType, type LoreFragment } from "../core/types";

const TYPE_LABEL: Record<LoreType, string> = {
  [LoreType.AudioLog]: "Audio Log",
  [LoreType.TextLog]: "Text Log",
  [LoreType.Environmental]: "Environmental",
  [LoreType.CrewRecording]: "Crew Recording",
};

/** Popup reader shown when a lore fragment is recovered (GDD §12.2). The full
 * Survey-Log archive reader is Phase 9; this is the immediate read. */
export class LoreReader {
  readonly root: HTMLDivElement;
  visible = false;

  private readonly titleEl: HTMLDivElement;
  private readonly metaEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly countEl: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "lore-reader hidden";
    this.root.innerHTML = `
      <div class="lore-card">
        <div class="lore-kicker">FRAGMENT RECOVERED</div>
        <div class="lore-title"></div>
        <div class="lore-meta"></div>
        <div class="lore-body"></div>
        <div class="lore-foot"><span class="lore-count"></span><span>[E] / [Tab] close</span></div>
      </div>`;
    parent.appendChild(this.root);
    this.titleEl = this.root.querySelector(".lore-title")!;
    this.metaEl = this.root.querySelector(".lore-meta")!;
    this.bodyEl = this.root.querySelector(".lore-body")!;
    this.countEl = this.root.querySelector(".lore-count")!;
  }

  show(f: LoreFragment, found: number, total: number): void {
    this.titleEl.textContent = f.title;
    this.metaEl.textContent = `${TYPE_LABEL[f.type]}${f.crew ? ` · ${f.crew}` : ""} · Act ${f.act}`;
    this.bodyEl.textContent = `"${f.content}"`;
    this.countEl.textContent = `${found} / ${total} fragments`;
    this.visible = true;
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.visible = false;
    this.root.classList.add("hidden");
  }
}
