import { CONFIG } from "../config";

/**
 * GDD §4.2 — timed status effects (`active_effects`). An effect carries a
 * remaining duration, an optional health tick, and stat-decay multipliers that
 * the Game folds into the per-frame StatTickInput. Definitions live here so a
 * new effect is one entry, not new plumbing.
 */
export interface EffectDef {
  id: string;
  name: string;
  tickDamage: number; // health lost per second (0 = none)
  hungerMult: number; // multiplier on hunger decay while active
  hydrationMult: number; // multiplier on hydration decay while active
}

export interface ActiveEffect {
  def: EffectDef;
  remaining: number;
}

const DEFS: Record<string, EffectDef> = {
  gut_rot: {
    id: "gut_rot",
    name: "Gut-rot",
    tickDamage: CONFIG.effects.gutRotTickDamage,
    hungerMult: CONFIG.effects.gutRotHungerMult,
    hydrationMult: 1,
  },
};

export class Effects {
  readonly active: ActiveEffect[] = [];

  reset(): void {
    this.active.length = 0;
  }

  /** Apply (or refresh) an effect by id; unknown ids are ignored. */
  add(id: string, duration: number): void {
    const def = DEFS[id];
    if (!def) return;
    const existing = this.active.find((e) => e.def.id === id);
    if (existing) existing.remaining = Math.max(existing.remaining, duration);
    else this.active.push({ def, remaining: duration });
  }

  has(id: string): boolean {
    return this.active.some((e) => e.def.id === id);
  }

  /** Tick durations down; returns the aggregates the stat sim needs this frame. */
  update(dt: number): { tickDamage: number; hungerMult: number; hydrationMult: number } {
    let tickDamage = 0;
    let hungerMult = 1;
    let hydrationMult = 1;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.remaining -= dt;
      if (e.remaining <= 0) {
        this.active.splice(i, 1);
        continue;
      }
      tickDamage += e.def.tickDamage;
      hungerMult *= e.def.hungerMult;
      hydrationMult *= e.def.hydrationMult;
    }
    return { tickDamage, hungerMult, hydrationMult };
  }

  serialize(): { id: string; remaining: number }[] {
    return this.active.map((e) => ({ id: e.def.id, remaining: e.remaining }));
  }

  load(list: { id: string; remaining: number }[] | undefined): void {
    this.reset();
    if (!list) return;
    for (const e of list) this.add(e.id, e.remaining);
  }
}
