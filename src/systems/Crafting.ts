import type { CraftingStation, Recipe } from "../core/types";
import { getItem } from "../data/items";
import { RECIPES } from "../data/recipes";
import type { Inventory } from "./Inventory";
import type { Knowledge } from "./Knowledge";

export interface CraftResult {
  ok: boolean;
  reason?: "missing_ingredients" | "no_space";
}

/**
 * GDD §5 — crafting. Resolves recipes for a given station, filtered to those the
 * player currently knows (see {@link Knowledge}).
 */
export class Crafting {
  readonly recipes: Recipe[] = RECIPES;

  /** Known recipes craftable at the given station. */
  available(station: CraftingStation, knowledge: Knowledge): Recipe[] {
    return this.recipes.filter((r) => r.station === station && knowledge.isKnown(r.id));
  }

  /** The recipe that produces an item (used for repair cost). */
  recipeForOutput(itemId: string): Recipe | undefined {
    return this.recipes.find((r) => r.outputItemId === itemId);
  }

  canCraft(recipe: Recipe, inv: Inventory): boolean {
    return recipe.ingredients.every((ing) => inv.has(ing.itemId, ing.quantity));
  }

  craft(recipe: Recipe, inv: Inventory): CraftResult {
    if (!this.canCraft(recipe, inv)) return { ok: false, reason: "missing_ingredients" };

    // Net weight change accounts for the space freed by consumed ingredients.
    const outWeight = getItem(recipe.outputItemId).weight * recipe.outputQuantity;
    let ingWeight = 0;
    for (const ing of recipe.ingredients) {
      ingWeight += getItem(ing.itemId).weight * ing.quantity;
    }
    if (inv.currentWeight + (outWeight - ingWeight) > inv.maxWeight + 1e-6) {
      return { ok: false, reason: "no_space" };
    }

    for (const ing of recipe.ingredients) inv.remove(ing.itemId, ing.quantity);
    inv.add(recipe.outputItemId, recipe.outputQuantity);
    return { ok: true };
  }
}
