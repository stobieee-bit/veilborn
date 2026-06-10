import { CONFIG } from "../config";
import { clamp } from "../core/math";

/** Per-frame inputs that affect stat simulation. */
export interface StatTickInput {
  /** True on the frame the player actively sprinted (drains stamina). */
  sprinting: boolean;
  /** Net warmth change this tick, per minute (negative = getting cold). */
  warmthDeltaPerMin: number;
  /** Net Veil Exposure change this tick, per minute. */
  veilDeltaPerMin: number;
  /** Stamina regen multiplier (augments). Defaults applied by caller. */
  staminaRegenMult: number;
  /** True when the player is underground (oxygen depletes). */
  underground: boolean;
  /** Effective max oxygen (raised by the Deep Lung augment). */
  oxygenMax: number;
  /** Hunger/hydration decay multiplier (GDD §16 difficulty slider). */
  decayMult: number;
  /** GDD §4.2 status-effect decay multipliers (1 = no active effect). */
  effectHungerMult: number;
  effectHydrationMult: number;
}

/**
 * GDD §4.1 / §4.2 — the six survival meters and their decay. Warmth and Veil
 * Exposure are driven by external rates (biome / weather / proximity) computed
 * by the Game and passed in each tick.
 */
export class SurvivalStats {
  health = 100;
  stamina = 100;
  hunger = 100;
  hydration = 100;
  warmth: number = CONFIG.warmth.start;
  veilExposure: number = CONFIG.veil.start;
  oxygen: number = CONFIG.oxygen.max;

  private staminaRegenCooldown = 0;

  reset(): void {
    this.health = 100;
    this.stamina = 100;
    this.hunger = 100;
    this.hydration = 100;
    this.warmth = CONFIG.warmth.start;
    this.veilExposure = CONFIG.veil.start;
    this.oxygen = CONFIG.oxygen.max;
    this.staminaRegenCooldown = 0;
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  get canSprint(): boolean {
    return this.stamina > 0;
  }

  get isCold(): boolean {
    return this.warmth < CONFIG.warmth.coldThreshold;
  }

  drainStamina(amount: number): void {
    this.stamina = clamp(this.stamina - amount, 0, CONFIG.stamina.max);
    this.staminaRegenCooldown = CONFIG.stamina.regenDelaySec;
  }

  trySpendStamina(amount: number): boolean {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.staminaRegenCooldown = CONFIG.stamina.regenDelaySec;
    return true;
  }

  eat(hunger: number): void {
    this.hunger = clamp(this.hunger + hunger, 0, 100);
  }

  drink(hydration: number): void {
    this.hydration = clamp(this.hydration + hydration, 0, 100);
  }

  heal(health: number): void {
    this.health = clamp(this.health + health, 0, 100);
  }

  damage(amount: number): void {
    this.health = clamp(this.health - amount, 0, 100);
  }

  update(dt: number, input: StatTickInput): void {
    const s = CONFIG.stats;
    const w = CONFIG.warmth;

    // Passive hunger / hydration decay (GDD per-minute -> per-second),
    // scaled by difficulty and any active status effects (GDD §4.2).
    this.hunger = clamp(
      this.hunger - (s.hungerDecayPerMin / 60) * input.decayMult * input.effectHungerMult * dt,
      0,
      100,
    );
    this.hydration = clamp(
      this.hydration -
        (s.hydrationDecayPerMin / 60) * input.decayMult * input.effectHydrationMult * dt,
      0,
      100,
    );

    // Warmth & Veil Exposure follow externally-computed rates.
    this.warmth = clamp(this.warmth + (input.warmthDeltaPerMin / 60) * dt, 0, w.max);
    this.veilExposure = clamp(
      this.veilExposure + (input.veilDeltaPerMin / 60) * dt,
      0,
      CONFIG.veil.max,
    );

    // Critical hunger/hydration drain health; comfortable levels slowly regen.
    let healthDelta = 0;
    if (this.hunger < s.hungerCritical) healthDelta -= s.healthDrainPerSecPerStat;
    if (this.hydration < s.hydrationCritical) healthDelta -= s.healthDrainPerSecPerStat;
    if (this.warmth < w.freezingThreshold) healthDelta -= w.freezingHealthPerSec;
    if (
      healthDelta === 0 &&
      this.hunger >= s.healthRegenHungerMin &&
      this.hydration >= s.healthRegenHydrationMin &&
      !this.isCold
    ) {
      healthDelta += s.healthRegenPerSec;
    }
    this.health = clamp(this.health + healthDelta * dt, 0, 100);

    // Oxygen (GDD §4.x, Warrens) — depletes underground, refills above.
    const o = CONFIG.oxygen;
    if (input.underground) {
      this.oxygen = clamp(this.oxygen - (o.max / o.secondsToEmpty) * dt, 0, input.oxygenMax);
      if (this.oxygen <= 0) this.health = clamp(this.health - o.suffocateHealthPerSec * dt, 0, 100);
    } else {
      this.oxygen = clamp(this.oxygen + o.regenPerSec * dt, 0, input.oxygenMax);
    }

    // Cold saps stamina (GDD §4.1 warmth critical effect).
    if (this.isCold) this.drainStamina(w.coldStaminaDrainPerSec * dt);

    // Stamina: drain while sprinting, otherwise regen after a short delay.
    if (input.sprinting) {
      this.drainStamina(CONFIG.stamina.sprintDrainPerSec * dt);
    } else if (this.staminaRegenCooldown > 0) {
      this.staminaRegenCooldown = Math.max(0, this.staminaRegenCooldown - dt);
    } else {
      this.stamina = clamp(
        this.stamina + CONFIG.stamina.regenPerSec * input.staminaRegenMult * dt,
        0,
        CONFIG.stamina.max,
      );
    }
  }
}
