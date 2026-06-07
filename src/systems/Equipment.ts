import { CONFIG } from "../config";
import type { ArmorSlot } from "../core/types";
import { getItem } from "../data/items";
import type { Inventory } from "./Inventory";

const SLOTS: ArmorSlot[] = ["head", "body", "hands"];

/**
 * GDD §7.1 — worn armor across the head/body/hands equipment slots. To keep the
 * prototype free of an extra loadout UI, each slot auto-equips the best (highest
 * armorValue, unbroken) armor of that slot currently carried; the worn set is
 * therefore derived from the inventory and needs no separate save state.
 */
export class Equipment {
  private worn: Record<ArmorSlot, string | null> = { head: null, body: null, hands: null };

  reset(): void {
    this.worn = { head: null, body: null, hands: null };
  }

  /** Item ids currently worn (one per occupied slot). */
  get wornIds(): string[] {
    return SLOTS.map((s) => this.worn[s]).filter((id): id is string => id !== null);
  }

  /** Re-pick the best armor of each slot from the inventory (call after any change). */
  refresh(inv: Inventory): void {
    for (const slot of SLOTS) {
      let best: string | null = null;
      let bestVal = -1;
      for (const stack of inv.stacks) {
        const def = getItem(stack.itemId);
        if (def.armorSlot !== slot) continue;
        if (stack.durability !== undefined && stack.durability <= 0) continue;
        const v = def.armorValue ?? 0;
        if (v > bestVal) {
          bestVal = v;
          best = stack.itemId;
        }
      }
      this.worn[slot] = best;
    }
  }

  /** Total incoming-damage reduction fraction (0..cap) from the worn set. */
  reduction(): number {
    let sum = 0;
    for (const id of this.wornIds) sum += getItem(id).armorValue ?? 0;
    return Math.min(CONFIG.armor.maxReduction, sum);
  }

  /** Multiplier applied to incoming damage (1 = no armor). */
  damageMult(): number {
    return 1 - this.reduction();
  }
}
