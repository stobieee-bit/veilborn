/** GDD §16 — settings & accessibility, persisted separately from the save. */
export type Aggression = "passive" | "low" | "normal" | "high";

export interface SettingsData {
  decayRate: number; // 0.25 – 2.0 (hunger/hydration)
  veilRate: number; // 0.0 – 2.0
  aggression: Aggression;
  fov: number; // 70 – 110
  headBobbing: boolean;
  sprintToggle: boolean;
  subtitles: boolean;
  alwaysShowStats: boolean; // accessibility: disable the GDD §13.2 hide rules
  highContrast: boolean;
  volume: number; // 0 – 1
  muted: boolean;
}

const DEFAULTS: SettingsData = {
  decayRate: 1,
  veilRate: 1,
  aggression: "normal",
  fov: 90,
  headBobbing: true,
  sprintToggle: false,
  subtitles: true,
  alwaysShowStats: false,
  highContrast: false,
  volume: 0.7,
  muted: false,
};

const KEY = "veilborn_settings_v1";

export class Settings {
  data: SettingsData = { ...DEFAULTS };

  constructor() {
    this.load();
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    this.save();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  // --- aggression helpers (GDD §16 creature aggression) ---
  get passive(): boolean {
    return this.data.aggression === "passive";
  }
  spawnDelayMult(): number {
    return { passive: Infinity, low: 1.6, normal: 1, high: 0.6 }[this.data.aggression];
  }
  damageMult(): number {
    return { passive: 0, low: 0.7, normal: 1, high: 1.4 }[this.data.aggression];
  }
}
