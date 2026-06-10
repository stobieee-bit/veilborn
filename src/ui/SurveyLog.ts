import { LoreType, type LoreFragment } from "../core/types";

const TYPE_LABEL: Record<LoreType, string> = {
  [LoreType.AudioLog]: "Audio Log",
  [LoreType.TextLog]: "Text Log",
  [LoreType.Environmental]: "Environmental",
  [LoreType.CrewRecording]: "Crew Recording",
};

/** Creature dossier text for the Survey Log creature log. */
const CREATURE_INFO: Record<string, { name: string; desc: string }> = {
  C01: { name: "Scout", desc: "Ashfields pack hunter. Patrols in threes; drawn by proximity and noise." },
  C02: { name: "Spineback", desc: "Spinewoods ambusher. Lurks by the trees and bursts when you linger." },
  C03: { name: "Drifter", desc: "Veil Sink floater. Drawn to high Veil Exposure from across the fog." },
  C04: { name: "Crawler", desc: "Warrens swarm. Weak alone, lethal in numbers around its nests." },
  C05: { name: "Bellower", desc: "Territorial caller. Bellows to rouse every creature nearby." },
  C06: { name: "Veil Wraith", desc: "Night stalker. Phases out of sight; untouchable while faded." },
  C07: { name: "Cradle-Spawn", desc: "The apex at the impact zone. Intelligent. It learns." },
};
const CREATURE_ORDER = ["C01", "C02", "C05", "C03", "C06", "C04", "C07"];

export interface AriaTopicView {
  id: string;
  label: string;
  response: string;
  available: boolean;
  asked: boolean;
}

export interface SurveyLogState {
  act: number;
  objective: string;
  beats: string[];
  fragments: LoreFragment[];
  foundCount: number;
  total: number;
  seen: string[];
  ariaGreeting: string;
  ariaTopics: AriaTopicView[];
  /** GDD §13.3 — known recipes (Tech tab). */
  recipes: { name: string; tier: number; ingredients: string }[];
  /** GDD §13.3 — augments + slot use (Tech tab). */
  augments: { name: string; installed: boolean }[];
  slotsUsed: number;
  slotsMax: number;
  /** GDD §11.2 — last scanner sweep, logged to the Survey Log. */
  lastScan: { clock: string; biome: string; deposits: number; lore: number; fauna: number } | null;
}

type Tab = "story" | "map" | "lore" | "creatures" | "tech" | "aria";

const TABS: [Tab, string][] = [
  ["story", "Story"],
  ["map", "Map"],
  ["lore", "Lore"],
  ["creatures", "Creatures"],
  ["tech", "Tech"],
  ["aria", "ARIA"],
];

/** GDD §13.3 Survey Log — the player's journal: story, lore archive, creature
 * dossier, and a line to ARIA. */
export class SurveyLog {
  readonly root: HTMLDivElement;
  visible = false;
  onAskAria: (topicId: string) => void = () => {};
  /** Game hooks this to draw the explored world onto the Map tab's canvas. */
  onRenderMap: (canvas: HTMLCanvasElement) => void = () => {};

  private tab: Tab = "story";
  private selectedTopic: string | null = null;
  private state: SurveyLogState | null = null;
  private readonly body: HTMLDivElement;
  private readonly tabsEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "survey-log hidden";
    this.root.innerHTML = `
      <div class="panel-head">SURVEY LOG <span class="hint">[J] / [Tab] close</span></div>
      <div class="sl-tabs"></div>
      <div class="sl-body"></div>`;
    parent.appendChild(this.root);
    this.tabsEl = this.root.querySelector(".sl-tabs")!;
    this.body = this.root.querySelector(".sl-body")!;
    for (const [id, label] of TABS) {
      const b = document.createElement("button");
      b.className = "sl-tab";
      b.textContent = label;
      b.addEventListener("click", () => { this.tab = id; this.render(); });
      this.tabsEl.appendChild(b);
    }
  }

  open(): void {
    this.visible = true;
    this.root.classList.remove("hidden");
  }
  hide(): void {
    this.visible = false;
    this.root.classList.add("hidden");
  }

  update(state: SurveyLogState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    if (!this.state) return;
    [...this.tabsEl.children].forEach((b, i) => {
      b.classList.toggle("active", TABS[i][0] === this.tab);
    });
    if (this.tab === "story") this.renderStory();
    else if (this.tab === "map") this.renderMap();
    else if (this.tab === "lore") this.renderLore();
    else if (this.tab === "creatures") this.renderCreatures();
    else if (this.tab === "tech") this.renderTech();
    else this.renderAria();
  }

  /** GDD §13.3 — world map (explored areas), drawn by the Game's map renderer. */
  private renderMap(): void {
    this.body.innerHTML = `
      <div class="sl-scroll sl-map-wrap">
        <canvas class="sl-map" width="380" height="380"></canvas>
        <div class="dim">Charted as you explore. The Topographic Mapper extends your survey radius.</div>
      </div>`;
    const canvas = this.body.querySelector(".sl-map") as HTMLCanvasElement;
    this.onRenderMap(canvas);
  }

  /** GDD §13.3 — known recipes, augment loadout, and the last scanner sweep. */
  private renderTech(): void {
    const s = this.state!;
    const scan = s.lastScan
      ? `<div class="sl-card"><div class="sl-card-title">Last Scanner Sweep</div>
         <div class="sl-card-body">${s.lastScan.clock} · ${s.lastScan.biome} — ${s.lastScan.deposits} deposit(s), ${s.lastScan.lore} lore signal(s), ${s.lastScan.fauna} creature signature(s)</div></div>`
      : `<div class="sl-card dim"><div class="sl-card-body">No scanner sweeps logged. Craft a Scanner and ping the terrain.</div></div>`;
    const augs = s.augments
      .map((a) => `<li class="${a.installed ? "" : "dim"}">${a.installed ? "◉" : "○"} ${a.name}</li>`)
      .join("");
    const recipes = s.recipes.length
      ? s.recipes
          .map(
            (r) => `
        <div class="sl-card">
          <div class="sl-card-title">${r.name} <small>T${r.tier}</small></div>
          <div class="sl-card-meta">${r.ingredients}</div>
        </div>`,
          )
          .join("")
      : "<div class='dim'>No recipes known yet — experiment with materials in hand.</div>";
    this.body.innerHTML = `
      <div class="sl-scroll">
        ${scan}
        <h4>Augments · ${s.slotsUsed}/${s.slotsMax} slots</h4>
        <ul class="sl-beats">${augs}</ul>
        <h4>Known Recipes · ${s.recipes.length}</h4>
        ${recipes}
      </div>`;
  }

  private renderStory(): void {
    const s = this.state!;
    const beats = s.beats.length
      ? s.beats.map((b) => `<li>${b}</li>`).join("")
      : "<li class='dim'>No story beats yet.</li>";
    this.body.innerHTML = `
      <div class="sl-scroll">
        <div class="sl-act">ACT ${s.act}</div>
        <div class="sl-objective">${s.objective}</div>
        <h4>Journal</h4>
        <ul class="sl-beats">${beats}</ul>
      </div>`;
  }

  private renderLore(): void {
    const s = this.state!;
    const cards = s.fragments.length
      ? s.fragments
          .map(
            (f) => `
        <div class="sl-card">
          <div class="sl-card-title">${f.title}</div>
          <div class="sl-card-meta">${TYPE_LABEL[f.type]}${f.crew ? ` · ${f.crew}` : ""} · Act ${f.act}</div>
          <div class="sl-card-body">"${f.content}"</div>
        </div>`,
          )
          .join("")
      : "<div class='dim'>No fragments recovered. They glow amber in the world — look for them.</div>";
    this.body.innerHTML = `
      <div class="sl-scroll">
        <div class="sl-count">${s.foundCount} / ${s.total} fragments recovered</div>
        ${cards}
      </div>`;
  }

  private renderCreatures(): void {
    const s = this.state!;
    const seen = new Set(s.seen);
    const cards = CREATURE_ORDER.map((id) => {
      const info = CREATURE_INFO[id];
      if (!seen.has(id)) {
        return `<div class="sl-card dim"><div class="sl-card-title">??? — Undiscovered</div></div>`;
      }
      return `
        <div class="sl-card">
          <div class="sl-card-title">${info.name} <small>${id}</small></div>
          <div class="sl-card-body">${info.desc}</div>
        </div>`;
    }).join("");
    this.body.innerHTML = `<div class="sl-scroll"><div class="sl-count">${seen.size} / ${CREATURE_ORDER.length} catalogued</div>${cards}</div>`;
  }

  private renderAria(): void {
    const s = this.state!;
    const selected = s.ariaTopics.find((t) => t.id === this.selectedTopic && t.available);
    const responseHtml = selected
      ? `<div class="aria-response">"${selected.response}"</div>`
      : `<div class="aria-response dim">${s.ariaGreeting}</div>`;
    const topics = s.ariaTopics
      .filter((t) => t.available)
      .map(
        (t) =>
          `<button class="aria-topic ${t.asked ? "asked" : ""}" data-id="${t.id}">${t.label}</button>`,
      )
      .join("");
    this.body.innerHTML = `
      <div class="aria-view">
        <div class="aria-name">ARIA · fragmentary</div>
        ${responseHtml}
        <div class="aria-topics">${topics}</div>
      </div>`;
    this.body.querySelectorAll(".aria-topic").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedTopic = (btn as HTMLElement).dataset.id!;
        this.onAskAria(this.selectedTopic);
      });
    });
  }
}
