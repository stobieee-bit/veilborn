import { CONFIG } from "../config";

/**
 * GDD §9.4 — the Cradle adaptation log. Tracks the player's combat tactics
 * against the apex; once it has eaten enough melee (or you've killed one), the
 * Cradle-Spawn species learns to resist and block your blade. Never resets
 * mid-run; cleared only on a new game.
 */
export class Adaptation {
  apexMeleeHits = 0;
  apexKills = 0;

  reset(): void {
    this.apexMeleeHits = 0;
    this.apexKills = 0;
  }

  get apexAdapted(): boolean {
    return this.apexKills >= 1 || this.apexMeleeHits >= CONFIG.adaptation.apexMeleeHitThreshold;
  }

  recordApexMelee(killed: boolean): void {
    this.apexMeleeHits++;
    if (killed) this.apexKills++;
  }

  serialize(): { apexMeleeHits: number; apexKills: number } {
    return { apexMeleeHits: this.apexMeleeHits, apexKills: this.apexKills };
  }

  load(d: { apexMeleeHits?: number; apexKills?: number } | undefined): void {
    this.reset();
    if (!d) return;
    this.apexMeleeHits = d.apexMeleeHits ?? 0;
    this.apexKills = d.apexKills ?? 0;
  }
}
