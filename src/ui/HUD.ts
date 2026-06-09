import { CONFIG } from "../config";

/**
 * DOM HUD overlay: crosshair, survival stat cluster, clock, interaction prompt,
 * hotbar, toasts, weather/threat cues, Veil/cold screen effects, and the
 * intro / death overlays.
 *
 * Note: the GDD §13.2 conditional-visibility rules (hide stats until critical)
 * are softened here to "subtle, brighten when low" so the prototype is legible
 * to a first-time player; strict conditional HUD is a Phase 11 polish task.
 */

export interface HotbarSlotView {
  empty: boolean;
  name: string;
  qty: number;
  kind: string; // ItemCategory lowercased, for the color dot
  selected: boolean;
}

export interface HudState {
  health: number;
  stamina: number;
  hunger: number;
  hydration: number;
  warmth: number;
  veilExposure: number;
  oxygen: number;
  oxygenMax: number;
  showOxygen: boolean;
  isSprinting: boolean;
  clock: string;
  isNight: boolean;
  weather: string | null;
  threat: number;
  biome: string;
  veilSense: boolean; // A02 augment: show the Veil Exposure readout
  veilDanger: boolean; // A02 augment: standing in a Veil-dense danger zone
  compass: string | null; // GDD §11.3 heading readout when "Compass always on"
  armorReduction: number; // GDD §7.1 worn-armor damage reduction (0 = none)
  power: { status: string; output: number; draw: number; batteryFrac: number } | null; // GDD §6.3 grid
  onboarding: { label: string; done: boolean }[] | null; // first-run getting-started steps
  minimalHud: boolean; // GDD §13.2 conditional visibility (off = always show)
  tracer: { bearing: number; dist: number; label: string } | null;
  prompt: string | null;
  lookingAtNode: boolean;
  hotbar: HotbarSlotView[];
  toolName: string | null;
  toolDurability: number | null; // 0..1 fraction, or null when no tool / unbreakable
}

interface StatRow {
  row: HTMLDivElement;
  fill: HTMLDivElement;
}

export class HUD {
  private readonly crosshair: HTMLDivElement;
  private readonly clockEl: HTMLDivElement;
  private readonly clockPhase: HTMLSpanElement;
  private readonly compassEl: HTMLDivElement;
  private readonly armorEl: HTMLDivElement;
  private readonly powerEl: HTMLDivElement;
  private readonly onboardEl: HTMLDivElement;
  private onboardSig = "";
  private readonly promptEl: HTMLDivElement;
  private readonly toastsEl: HTMLDivElement;
  private readonly hotbarEl: HTMLDivElement;
  // Cached hotbar cell refs + last-rendered signature (avoids per-frame querySelector + DOM writes).
  private hotbarCells: {
    root: HTMLDivElement;
    name: HTMLElement;
    qty: HTMLElement;
    dot: HTMLElement;
    sig: string;
  }[] = [];
  private readonly rows: Record<string, StatRow> = {};
  private readonly veilOverlay: HTMLDivElement;
  private readonly coldOverlay: HTMLDivElement;
  private readonly damageFlash: HTMLDivElement;
  private readonly weatherEl: HTMLDivElement;
  private readonly biomeEl: HTMLDivElement;
  private readonly threatEl: HTMLDivElement;
  private readonly durabilityEl: HTMLDivElement;
  private readonly durabilityFill: HTMLDivElement;
  private readonly durabilityLabel: HTMLSpanElement;
  private readonly saveIndicator: HTMLDivElement;
  private saveTimer = 0;
  private hitMarkerTimer = 0;
  private readonly veilReadoutEl: HTMLDivElement;
  private readonly hallucinateEl: HTMLDivElement;
  private readonly episodeEl: HTMLDivElement;
  private readonly episodeTextEl: HTMLDivElement;
  private readonly tracerEl: HTMLDivElement;
  private readonly tracerArrow: HTMLDivElement;
  private readonly tracerText: HTMLSpanElement;
  readonly introEl: HTMLDivElement;
  readonly deathEl: HTMLDivElement;
  readonly pauseEl: HTMLDivElement;
  readonly introNewBtn: HTMLButtonElement;
  readonly introContinueBtn: HTMLButtonElement;
  readonly introSettingsBtn: HTMLButtonElement;
  readonly introHelpBtn: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.crosshair = el("div", "crosshair");
    root.appendChild(this.crosshair);

    // Screen-effect overlays (behind the HUD widgets but above the canvas).
    this.veilOverlay = el("div", "fx veil-overlay");
    this.coldOverlay = el("div", "fx cold-overlay");
    this.damageFlash = el("div", "fx damage-flash");
    this.hallucinateEl = el("div", "fx hallucinate");
    root.append(this.veilOverlay, this.coldOverlay, this.damageFlash, this.hallucinateEl);

    // Veil Episode overlay (GDD §4.1)
    this.episodeEl = el("div", "veil-episode hidden");
    this.episodeEl.innerHTML = `<div class="ve-inner"><div class="ve-kicker">VEIL EPISODE</div><div class="ve-text"></div><div class="ve-hint">Hold&nbsp; F &nbsp;to embrace the Veil · endure to survive</div></div>`;
    this.episodeTextEl = this.episodeEl.querySelector(".ve-text")!;
    root.appendChild(this.episodeEl);

    // Stat cluster
    const stats = el("div", "stats");
    for (const key of ["health", "stamina", "hunger", "hydration", "warmth", "oxygen"] as const) {
      const row = el("div", "stat");
      const label = el("span", "label");
      label.textContent = key.slice(0, 4);
      const track = el("div", "track");
      const fill = el("div", `fill ${key}`);
      track.appendChild(fill);
      row.append(label, track);
      stats.appendChild(row);
      this.rows[key] = { row, fill };
    }
    root.appendChild(stats);

    // Clock
    this.clockEl = el("div", "clock");
    this.clockEl.textContent = "08:00";
    this.clockPhase = el("span", "phase");
    this.clockPhase.textContent = "DAY";
    this.clockEl.appendChild(this.clockPhase);
    root.appendChild(this.clockEl);

    // Compass (top-center heading readout; shown only when enabled in Settings)
    this.compassEl = el("div", "compass");
    root.appendChild(this.compassEl);

    // Weather chip (under the clock) + threat cue (top-center).
    this.weatherEl = el("div", "weather");
    root.appendChild(this.weatherEl);
    this.powerEl = el("div", "power-readout"); // base power-grid status (top-right)
    root.appendChild(this.powerEl);
    this.biomeEl = el("div", "biome");
    root.appendChild(this.biomeEl);
    this.veilReadoutEl = el("div", "veil-readout");
    root.appendChild(this.veilReadoutEl);
    this.threatEl = el("div", "threat");
    this.threatEl.textContent = "⚠ HUNTED";
    root.appendChild(this.threatEl);

    // Signal Tracer direction indicator (GDD §11.3)
    this.tracerEl = el("div", "tracer");
    this.tracerArrow = el("div", "tracer-arrow");
    this.tracerArrow.textContent = "▲";
    this.tracerText = el("span", "tracer-text");
    this.tracerEl.append(this.tracerArrow, this.tracerText);
    root.appendChild(this.tracerEl);

    // Prompt
    this.promptEl = el("div", "prompt");
    root.appendChild(this.promptEl);

    // Toasts
    this.toastsEl = el("div", "toasts");
    root.appendChild(this.toastsEl);

    // Hotbar
    this.hotbarEl = el("div", "hotbar");
    root.appendChild(this.hotbarEl);

    // Tool durability (bottom-right, only when a breakable tool is equipped)
    this.durabilityEl = el("div", "tool-dura");
    this.durabilityLabel = el("span", "td-label");
    const track = el("div", "td-track");
    this.durabilityFill = el("div", "td-fill");
    track.appendChild(this.durabilityFill);
    this.durabilityEl.append(this.durabilityLabel, track);
    root.appendChild(this.durabilityEl);

    // Worn-armor readout (bottom-right, only when armor is worn)
    this.armorEl = el("div", "armor-readout");
    root.appendChild(this.armorEl);

    // First-run "Getting Started" checklist (right side, only during onboarding)
    this.onboardEl = el("div", "onboarding");
    root.appendChild(this.onboardEl);

    this.saveIndicator = el("div", "save-indicator");
    this.saveIndicator.textContent = "✓ Saved";
    root.appendChild(this.saveIndicator);

    // Overlays
    this.introEl = this.buildIntro();
    this.introContinueBtn = this.introEl.querySelector(".btn-continue")!;
    this.introNewBtn = this.introEl.querySelector(".btn-new")!;
    this.introSettingsBtn = this.introEl.querySelector(".btn-settings")!;
    this.introHelpBtn = this.introEl.querySelector(".btn-help")!;
    this.deathEl = this.buildDeath();
    this.pauseEl = el("div", "overlay pause hidden");
    this.pauseEl.innerHTML = `
      <div class="sub">Paused</div>
      <div class="cta">Click to resume</div>`;
    root.append(this.introEl, this.deathEl, this.pauseEl);
  }

  update(s: HudState): void {
    // GDD §13.2 conditional visibility (unless accessibility "always show").
    const m = s.minimalHud;
    const coldT = CONFIG.warmth.coldThreshold;
    const oxFrac = s.oxygenMax > 0 ? s.oxygen / s.oxygenMax : 0;
    this.applyStat("health", s.health / 100, !m || s.health < 50, s.health < 60, s.health < 20);
    this.applyStat("stamina", s.stamina / 100, !m || s.isSprinting, s.isSprinting || s.stamina < 35, false);
    this.applyStat("hunger", s.hunger / 100, !m || s.hunger < 25, s.hunger < 25, s.hunger < 15);
    this.applyStat("hydration", s.hydration / 100, !m || s.hydration < 25, s.hydration < 25, s.hydration < 10);
    this.applyStat("warmth", s.warmth / 100, !m || s.warmth < coldT, s.warmth < 45, s.warmth < coldT);
    this.applyStat("oxygen", oxFrac, s.showOxygen, oxFrac < 0.4, oxFrac < 0.15);

    this.clockEl.firstChild!.textContent = s.clock + " ";
    this.clockPhase.textContent = s.isNight ? "NIGHT" : "DAY";

    if (s.compass) {
      this.compassEl.textContent = s.compass;
      this.compassEl.classList.add("show");
    } else {
      this.compassEl.classList.remove("show");
    }

    if (s.weather) {
      this.weatherEl.textContent = s.weather;
      this.weatherEl.classList.add("show");
    } else {
      this.weatherEl.classList.remove("show");
    }

    if (s.power) {
      const cls = s.power.status === "STABLE" ? "stable" : s.power.status === "OVERLOADED" ? "warn" : "off";
      this.powerEl.className = `power-readout show ${cls}`;
      this.powerEl.textContent =
        `⚡ ${s.power.status} · ${Math.round(s.power.output)}/${Math.round(s.power.draw)}W · 🔋${Math.round(s.power.batteryFrac * 100)}%`;
    } else {
      this.powerEl.classList.remove("show");
    }
    this.threatEl.classList.toggle("show", s.threat > 0);
    this.biomeEl.textContent = s.biome;

    if (s.tracer) {
      this.tracerEl.classList.add("show");
      this.tracerArrow.style.transform = `rotate(${s.tracer.bearing}rad)`;
      this.tracerText.textContent = `${s.tracer.label} · ${Math.round(s.tracer.dist)}m`;
    } else {
      this.tracerEl.classList.remove("show");
    }

    // Veil Exposure: vein-like teal creep from the screen edge (GDD §13.2).
    const veil =
      Math.max(0, s.veilExposure - CONFIG.veil.distortStart) /
      (100 - CONFIG.veil.distortStart);
    this.veilOverlay.style.opacity = String(Math.min(1, veil) * 0.9);

    if (s.veilSense) {
      this.veilReadoutEl.classList.add("show");
      const pct = Math.round(s.veilExposure);
      this.veilReadoutEl.textContent = s.veilDanger
        ? `VEIL EXPOSURE  ${pct}%  ⚠ DENSE ZONE`
        : `VEIL EXPOSURE  ${pct}%`;
      this.veilReadoutEl.classList.toggle("danger", s.veilDanger);
    } else {
      this.veilReadoutEl.classList.remove("show");
    }

    // High exposure: intensified distortion + peripheral hallucination.
    const haunted = s.veilExposure >= CONFIG.veil.hallucinateStart;
    this.veilOverlay.classList.toggle("intense", haunted);
    this.hallucinateEl.classList.toggle("show", haunted);

    // Cold: frosted vignette + slight blur when warmth is low.
    const cold = Math.max(0, CONFIG.warmth.coldThreshold - s.warmth) / CONFIG.warmth.coldThreshold;
    this.coldOverlay.style.opacity = String(cold * 0.85);
    this.coldOverlay.style.setProperty("--blur", (cold * 2.6).toFixed(2) + "px");

    if (s.prompt) {
      this.promptEl.innerHTML = s.prompt;
      this.promptEl.classList.add("show");
    } else {
      this.promptEl.classList.remove("show");
    }
    this.crosshair.classList.toggle("active", s.lookingAtNode);

    if (s.toolDurability !== null && s.toolName) {
      this.durabilityEl.classList.add("show");
      this.durabilityLabel.textContent = s.toolName;
      this.durabilityFill.style.transform = `scaleX(${Math.max(0, s.toolDurability)})`;
      this.durabilityFill.classList.toggle("low", s.toolDurability < 0.25);
    } else {
      this.durabilityEl.classList.remove("show");
    }

    if (s.armorReduction > 0) {
      this.armorEl.textContent = `🛡 ARMOR ${Math.round(s.armorReduction * 100)}%`;
      this.armorEl.classList.add("show");
    } else {
      this.armorEl.classList.remove("show");
    }

    if (s.onboarding && s.onboarding.length) {
      const sig = s.onboarding.map((o) => (o.done ? "1" : "0")).join("");
      if (sig !== this.onboardSig) {
        this.onboardSig = sig;
        this.onboardEl.innerHTML =
          `<div class="ob-title">Getting Started</div>` +
          s.onboarding
            .map((o) => `<div class="ob-step ${o.done ? "done" : ""}">${o.done ? "✓" : "○"} ${o.label}</div>`)
            .join("") +
          `<div class="ob-hint">Press <span class="key">[H]</span> for help</div>`;
      }
      this.onboardEl.classList.add("show");
    } else {
      this.onboardSig = "";
      this.onboardEl.classList.remove("show");
    }

    this.renderHotbar(s.hotbar);
  }

  showEpisode(active: boolean): void {
    this.episodeEl.classList.toggle("hidden", !active);
  }

  showSaved(): void {
    this.saveIndicator.classList.add("show");
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveIndicator.classList.remove("show"), 1400);
  }

  /** Briefly flash the crosshair to confirm a melee hit landed (game feel). */
  hitMarker(): void {
    this.crosshair.classList.add("hit");
    window.clearTimeout(this.hitMarkerTimer);
    this.hitMarkerTimer = window.setTimeout(() => this.crosshair.classList.remove("hit"), 110);
  }

  setEpisodeText(text: string): void {
    this.episodeTextEl.textContent = text;
  }

  /** Flash the screen red when the player takes a hit. */
  flashDamage(): void {
    this.damageFlash.classList.remove("hit");
    // Force reflow so the animation restarts even on rapid consecutive hits.
    void this.damageFlash.offsetWidth;
    this.damageFlash.classList.add("hit");
  }

  private applyStat(
    key: string,
    frac: number,
    show: boolean,
    attention: boolean,
    critical: boolean,
  ): void {
    const r = this.rows[key];
    r.fill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
    r.row.classList.toggle("hidden", !show);
    r.row.classList.toggle("attention", attention);
    r.row.classList.toggle("critical", critical);
  }

  private renderHotbar(slots: HotbarSlotView[]): void {
    // (Re)build the cells + cache their child refs only when the slot count changes.
    if (this.hotbarCells.length !== slots.length) {
      this.hotbarEl.innerHTML = "";
      this.hotbarCells = [];
      for (let i = 0; i < slots.length; i++) {
        const slot = el("div", "slot");
        slot.innerHTML = `<span class="num">${i + 1}</span><span class="qty"></span><span class="dot"></span><span class="name"></span>`;
        this.hotbarEl.appendChild(slot);
        this.hotbarCells.push({
          root: slot,
          name: slot.querySelector(".name") as HTMLElement,
          qty: slot.querySelector(".qty") as HTMLElement,
          dot: slot.querySelector(".dot") as HTMLElement,
          sig: "",
        });
      }
    }
    for (let i = 0; i < slots.length; i++) {
      const v = slots[i];
      const cell = this.hotbarCells[i];
      // Only touch the DOM when this slot's rendered state actually changed.
      const sig = `${v.empty ? 1 : 0}|${v.kind}|${v.selected ? 1 : 0}|${v.empty ? "" : v.name}|${v.empty ? 0 : v.qty}`;
      if (sig === cell.sig) continue;
      cell.sig = sig;
      cell.root.className = `slot ${v.empty ? "" : v.kind} ${v.selected ? "selected" : ""}`;
      cell.name.textContent = v.empty ? "" : v.name;
      cell.qty.textContent = !v.empty && v.qty > 1 ? String(v.qty) : "";
      cell.dot.style.display = v.empty ? "none" : "block";
    }
  }

  toast(message: string): void {
    const t = el("div", "toast");
    t.textContent = message;
    this.toastsEl.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  showIntro(show: boolean): void {
    this.introEl.classList.toggle("hidden", !show);
  }

  showDeath(show: boolean): void {
    this.deathEl.classList.toggle("hidden", !show);
  }

  showPause(show: boolean): void {
    this.pauseEl.classList.toggle("hidden", !show);
  }

  setContinueAvailable(available: boolean): void {
    this.introContinueBtn.classList.toggle("hidden", !available);
  }

  private buildIntro(): HTMLDivElement {
    const o = el("div", "overlay");
    o.innerHTML = `
      <h1>VEIL<span class="b">BORN</span></h1>
      <div class="sub">Sci-Fi Survival · the living world of Vaelun</div>
      <div class="controls">
        <div><b>Move</b> W A S D</div>
        <div><b>Sprint</b> Hold Shift &nbsp; <b>Crouch</b> Ctrl / C &nbsp; <b>Jump</b> Space</div>
        <div><b>Look</b> Mouse &nbsp; <b>Interact</b> E</div>
        <div><b>Hotbar</b> 1 – 6 &nbsp; <b>Inventory / Craft</b> Tab &nbsp; <b>Build</b> B</div>
        <div><b>Survey Log</b> J &nbsp; <b>Help</b> H &nbsp; <b>Pause look</b> Esc</div>
      </div>
      <div class="intro-buttons">
        <button class="intro-btn primary btn-continue hidden">Continue</button>
        <button class="intro-btn btn-new">New Game</button>
        <button class="intro-btn btn-help">How to Play</button>
        <button class="intro-btn btn-settings">Settings</button>
      </div>`;
    return o;
  }

  private buildDeath(): HTMLDivElement {
    const o = el("div", "overlay death hidden");
    o.innerHTML = `
      <h1>YOU DID NOT SURVIVE</h1>
      <div class="sub">Vaelun reclaims what it is owed</div>
      <div class="cta">Click to wake in a new escape pod</div>`;
    return o;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
