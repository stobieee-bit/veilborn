import { CONFIG } from "../config";
import { AUGMENT_BY_ID, MAX_AUGMENT_SLOTS } from "../data/augments";

/**
 * GDD §8.2 — installed augments (max 5 slots; some cost 2). The effect getters
 * are read by the relevant systems (carry weight, stamina, warmth, veil, etc.).
 */
export class AugmentSystem {
  readonly maxSlots = MAX_AUGMENT_SLOTS;
  private readonly installed = new Set<string>();

  reset(): void {
    this.installed.clear();
  }

  get installedIds(): string[] {
    return [...this.installed];
  }

  usedSlots(): number {
    let n = 0;
    for (const id of this.installed) n += AUGMENT_BY_ID[id]?.slotCost ?? 1;
    return n;
  }

  canInstall(id: string): { ok: boolean; reason?: string } {
    if (this.installed.has(id)) return { ok: false, reason: "Already installed" };
    const def = AUGMENT_BY_ID[id];
    if (!def) return { ok: false, reason: "Unknown augment" };
    if (this.usedSlots() + def.slotCost > this.maxSlots) {
      return { ok: false, reason: "Not enough slots" };
    }
    return { ok: true };
  }

  install(id: string): boolean {
    if (!this.canInstall(id).ok) return false;
    this.installed.add(id);
    return true;
  }

  uninstall(id: string): boolean {
    return this.installed.delete(id);
  }

  serialize(): string[] {
    return [...this.installed];
  }

  load(ids: string[]): void {
    this.installed.clear();
    for (const id of ids) if (AUGMENT_BY_ID[id]) this.installed.add(id);
  }

  // --- effect getters ---
  carryBonus(): number {
    return this.installed.has("A04") ? 10 : 0;
  }
  staminaRegenMult(): number {
    return this.installed.has("A06") ? 1.25 : 1;
  }
  warmthDrainMult(): number {
    return this.installed.has("A03") ? 0.6 : 1;
  }
  veilRiseMult(): number {
    return this.installed.has("A07") ? 0.7 : 1;
  }
  damageTakenMult(): number {
    return this.installed.has("A08") ? 0.85 : 1;
  }
  hasVeilSense(): boolean {
    return this.installed.has("A02");
  }
  hasIronGut(): boolean {
    return this.installed.has("A01");
  }
  /** Deep Lung (A05): +50% oxygen reserve (GDD §8.2). */
  oxygenMaxMult(): number {
    return this.installed.has("A05") ? CONFIG.oxygen.deepLungMult : 1;
  }
}
