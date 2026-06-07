import type { Aggression, Settings } from "../systems/Settings";

/** GDD §16 — settings & accessibility menu. */
export class SettingsMenu {
  readonly root: HTMLDivElement;
  visible = false;
  onChange: () => void = () => {};

  private readonly body: HTMLDivElement;

  constructor(parent: HTMLElement, private readonly settings: Settings) {
    this.root = document.createElement("div");
    this.root.className = "settings-panel hidden";
    this.root.innerHTML = `
      <div class="panel-head">SETTINGS <span class="hint">[Esc] / [O] close</span></div>
      <div class="settings-body"></div>`;
    parent.appendChild(this.root);
    this.body = this.root.querySelector(".settings-body")!;
    this.build();
  }

  open(): void {
    this.visible = true;
    this.root.classList.remove("hidden");
  }
  hide(): void {
    this.visible = false;
    this.root.classList.add("hidden");
  }

  private build(): void {
    const d = this.settings.data;
    this.slider("Hunger / Thirst decay", 0.25, 2, 0.25, d.decayRate, (v) => this.set("decayRate", v), (v) => `${v.toFixed(2)}×`);
    this.slider("Veil Exposure rate", 0, 2, 0.25, d.veilRate, (v) => this.set("veilRate", v), (v) => `${v.toFixed(2)}×`);
    this.select("Creature aggression", ["passive", "low", "normal", "high"], d.aggression, (v) => this.set("aggression", v as Aggression));
    this.slider("Field of view", 70, 110, 5, d.fov, (v) => this.set("fov", v), (v) => `${v}°`);
    this.slider("Master volume", 0, 1, 0.05, d.volume, (v) => this.set("volume", v), (v) => `${Math.round(v * 100)}%`);
    this.toggle("Mute", d.muted, (v) => this.set("muted", v));
    this.toggle("Head bobbing", d.headBobbing, (v) => this.set("headBobbing", v));
    this.toggle("Sprint toggle", d.sprintToggle, (v) => this.set("sprintToggle", v));
    this.toggle("Compass always on", d.compass, (v) => this.set("compass", v));
    this.toggle("Subtitles", d.subtitles, (v) => this.set("subtitles", v));
    this.toggle("Always show stats (accessibility)", d.alwaysShowStats, (v) => this.set("alwaysShowStats", v));
    this.toggle("High-contrast markers", d.highContrast, (v) => this.set("highContrast", v));
  }

  private set<K extends keyof typeof this.settings.data>(key: K, value: (typeof this.settings.data)[K]): void {
    this.settings.set(key, value);
    this.onChange();
  }

  private row(label: string): HTMLDivElement {
    const r = document.createElement("div");
    r.className = "set-row";
    const l = document.createElement("span");
    l.className = "set-label";
    l.textContent = label;
    r.appendChild(l);
    this.body.appendChild(r);
    return r;
  }

  private slider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (v: number) => void,
    fmt: (v: number) => string,
  ): void {
    const r = this.row(label);
    const val = document.createElement("span");
    val.className = "set-val";
    val.textContent = fmt(value);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      onInput(v);
    });
    r.append(input, val);
  }

  private toggle(label: string, value: boolean, onInput: (v: boolean) => void): void {
    const r = this.row(label);
    const btn = document.createElement("button");
    btn.className = `set-toggle ${value ? "on" : ""}`;
    btn.textContent = value ? "ON" : "OFF";
    btn.addEventListener("click", () => {
      const v = !btn.classList.contains("on");
      btn.classList.toggle("on", v);
      btn.textContent = v ? "ON" : "OFF";
      onInput(v);
    });
    r.appendChild(btn);
  }

  private select(label: string, options: string[], value: string, onInput: (v: string) => void): void {
    const r = this.row(label);
    const sel = document.createElement("select");
    sel.className = "set-select";
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o[0].toUpperCase() + o.slice(1);
      if (o === value) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => onInput(sel.value));
    r.appendChild(sel);
  }
}
