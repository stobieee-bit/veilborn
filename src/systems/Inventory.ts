import { CONFIG } from "../config";
import { ItemCategory, type ItemStack } from "../core/types";
import { getItem } from "../data/items";

/**
 * GDD §7 — weight-capped inventory (not grid based) plus a 6-slot hotbar.
 * Simplification for Phase 1: one merged stack per item id (stackSize is kept
 * as data for the later split-stack UI). The hard limit is total carry weight.
 */
export class Inventory {
  readonly baseWeight: number;
  bonusWeight = 0; // from augments (A04 Carrier Frame)
  stacks: ItemStack[] = [];
  hotbar: (string | null)[] = new Array(CONFIG.inventory.hotbarSlots).fill(null);

  constructor(maxWeight: number = CONFIG.inventory.maxWeight) {
    this.baseWeight = maxWeight;
  }

  get maxWeight(): number {
    return this.baseWeight + this.bonusWeight;
  }

  reset(): void {
    this.stacks = [];
    this.hotbar.fill(null);
  }

  get currentWeight(): number {
    let w = 0;
    for (const s of this.stacks) w += getItem(s.itemId).weight * s.quantity;
    return w;
  }

  get remainingWeight(): number {
    return Math.max(0, this.maxWeight - this.currentWeight);
  }

  count(itemId: string): number {
    return this.stacks.find((s) => s.itemId === itemId)?.quantity ?? 0;
  }

  has(itemId: string, qty: number): boolean {
    return this.count(itemId) >= qty;
  }

  /**
   * Add up to `qty` of an item, limited by remaining carry weight.
   * Returns how many were actually added (0 if over weight).
   */
  add(itemId: string, qty: number): number {
    const item = getItem(itemId);
    const fitByWeight =
      item.weight > 0 ? Math.floor(this.remainingWeight / item.weight) : qty;
    const addable = Math.min(qty, Math.max(0, fitByWeight));
    if (addable <= 0) return 0;

    const existing = this.stacks.find((s) => s.itemId === itemId);
    if (existing) existing.quantity += addable;
    else {
      const stack: ItemStack = { itemId, quantity: addable };
      if (item.maxDurability !== undefined) stack.durability = item.maxDurability;
      this.stacks.push(stack);
    }

    this.autoAssignHotbar(itemId);
    return addable;
  }

  getStack(itemId: string): ItemStack | undefined {
    return this.stacks.find((s) => s.itemId === itemId);
  }

  /** Wear a tool's durability. Returns "broke" if it shattered (and was removed). */
  damageDurability(itemId: string, amount: number): "ok" | "broke" | "none" {
    const stack = this.getStack(itemId);
    if (!stack || stack.durability === undefined) return "none";
    stack.durability -= amount;
    if (stack.durability <= 0) {
      this.remove(itemId, 1);
      return "broke";
    }
    return "ok";
  }

  /** Restore durability up to the item's maximum. */
  repairTool(itemId: string, amount: number): void {
    const stack = this.getStack(itemId);
    const item = getItem(itemId);
    if (!stack || stack.durability === undefined || item.maxDurability === undefined) return;
    stack.durability = Math.min(item.maxDurability, stack.durability + amount);
  }

  /** Remove `qty` of an item. Returns false if not enough were held. */
  remove(itemId: string, qty: number): boolean {
    const stack = this.stacks.find((s) => s.itemId === itemId);
    if (!stack || stack.quantity < qty) return false;
    stack.quantity -= qty;
    if (stack.quantity <= 0) {
      this.stacks = this.stacks.filter((s) => s !== stack);
      // Clear emptied item from any hotbar slot it occupied.
      for (let i = 0; i < this.hotbar.length; i++) {
        if (this.hotbar[i] === itemId) this.hotbar[i] = null;
      }
    }
    return true;
  }

  /** Usable items (tool/consumable/placeable) claim the first free hotbar slot. */
  private autoAssignHotbar(itemId: string): void {
    const item = getItem(itemId);
    if (item.category === ItemCategory.Material || item.category === ItemCategory.Augment) {
      return;
    }
    if (this.hotbar.includes(itemId)) return;
    const free = this.hotbar.indexOf(null);
    if (free !== -1) this.hotbar[free] = itemId;
  }
}
