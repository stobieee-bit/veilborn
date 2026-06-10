import { CONFIG } from "../config";

/**
 * GDD §9.4 — the adaptation log. Vaelun learns the player's tactics:
 * - Melee the apex enough (or kill one) and Cradle-Spawn block/resist blades.
 * - Kill 3+ Crawlers with fire and the species gains fire resistance (+60%).
 * Never resets mid-run; cleared only on a new game.
 */
export class Adaptation {
  apexMeleeHits = 0;
  apexKills = 0;
  crawlerFireKills = 0;

  reset(): void {
    this.apexMeleeHits = 0;
    this.apexKills = 0;
    this.crawlerFireKills = 0;
  }

  get apexAdapted(): boolean {
    return this.apexKills >= 1 || this.apexMeleeHits >= CONFIG.adaptation.apexMeleeHitThreshold;
  }

  /** GDD §9.4 — "kills 3+ Crawlers with fire → fire resistance (+60%)". */
  get crawlerFireAdapted(): boolean {
    return this.crawlerFireKills >= CONFIG.adaptation.crawlerFireKillThreshold;
  }

  recordApexMelee(killed: boolean): void {
    this.apexMeleeHits++;
    if (killed) this.apexKills++;
  }

  /** Returns true on the kill that tips the species into adaptation. */
  recordCrawlerFireKill(): boolean {
    const was = this.crawlerFireAdapted;
    this.crawlerFireKills++;
    return !was && this.crawlerFireAdapted;
  }

  serialize(): { apexMeleeHits: number; apexKills: number; crawlerFireKills: number } {
    return {
      apexMeleeHits: this.apexMeleeHits,
      apexKills: this.apexKills,
      crawlerFireKills: this.crawlerFireKills,
    };
  }

  load(
    d: { apexMeleeHits?: number; apexKills?: number; crawlerFireKills?: number } | undefined,
  ): void {
    this.reset();
    if (!d) return;
    this.apexMeleeHits = d.apexMeleeHits ?? 0;
    this.apexKills = d.apexKills ?? 0;
    this.crawlerFireKills = d.crawlerFireKills ?? 0;
  }
}
