import { CraftingStation } from "../core/types";
import { RECIPES } from "../data/recipes";
import type { Inventory } from "./Inventory";

/**
 * GDD §5.1 — recipe knowledge. Tier 0 is known from the start; higher tiers are
 * "discovered" by experimentation (holding all ingredients at once) once the
 * required station exists. There are no recipe books.
 */
export class Knowledge {
  private readonly known = new Set<string>();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.known.clear();
    for (const r of RECIPES) if (r.tier === 0) this.known.add(r.id);
  }

  isKnown(id: string): boolean {
    return this.known.has(id);
  }

  /** GDD §5.1 — directly teach a recipe (e.g. from a recovered lore fragment). */
  learn(id: string): boolean {
    if (this.known.has(id)) return false;
    this.known.add(id);
    return true;
  }

  serialize(): string[] {
    return [...this.known];
  }

  load(ids: string[]): void {
    this.known.clear();
    for (const id of ids) this.known.add(id);
    for (const r of RECIPES) if (r.tier === 0) this.known.add(r.id); // safety floor
  }

  /**
   * Reveal any recipe whose ingredients are all currently held and whose
   * station is available. Returns the display names newly discovered.
   */
  discover(
    inv: Inventory,
    opts: { hasFabricator: boolean; hasTier2: boolean; hasTier3: boolean },
  ): string[] {
    const found: string[] = [];
    for (const r of RECIPES) {
      if (this.known.has(r.id)) continue;
      if (r.station === CraftingStation.Fabricator && !opts.hasFabricator) continue;
      if (r.tier >= 2 && !opts.hasTier2) continue;
      if (r.tier >= 3 && !opts.hasTier3) continue;
      if (r.ingredients.every((ing) => inv.has(ing.itemId, ing.quantity))) {
        this.known.add(r.id);
        found.push(r.name);
      }
    }
    return found;
  }
}
