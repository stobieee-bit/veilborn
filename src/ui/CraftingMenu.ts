import { CraftingStation } from "../core/types";
import { getItem } from "../data/items";
import type { Crafting } from "../systems/Crafting";
import type { Inventory } from "../systems/Inventory";
import type { Knowledge } from "../systems/Knowledge";

/** GDD §13.3 — the crafting panel, used both for HAND field crafting (Survey
 * Log) and the FABRICATOR (Tier-1 recipes + tool repair). Only re-rendered on
 * open and after each action — never per frame. */
export class CraftingMenu {
  readonly root: HTMLDivElement;
  visible = false;
  station: CraftingStation = CraftingStation.Hand;
  onCraft: (recipeId: string) => void = () => {};
  onRepair: (itemId: string) => void = () => {};

  private readonly titleEl: HTMLSpanElement;
  private readonly invList: HTMLUListElement;
  private readonly recipeList: HTMLUListElement;
  private readonly weightEl: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "craft-panel hidden";
    this.root.innerHTML = `
      <div class="panel-head"><span class="ph-title">SURVEY LOG · FIELD CRAFTING</span> <span class="hint">[Tab] close</span></div>
      <div class="panel-body">
        <div class="col">
          <h3>Inventory <span class="weight"></span></h3>
          <ul class="inv-list"></ul>
        </div>
        <div class="col">
          <h3 class="craft-head">Hand Crafting · Tier 0</h3>
          <ul class="recipe-list"></ul>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.titleEl = this.root.querySelector(".ph-title")!;
    this.invList = this.root.querySelector(".inv-list")!;
    this.recipeList = this.root.querySelector(".recipe-list")!;
    this.weightEl = this.root.querySelector(".weight")!;
  }

  open(station: CraftingStation): void {
    this.station = station;
    this.visible = true;
    this.root.classList.remove("hidden");
    const fab = station === CraftingStation.Fabricator;
    this.titleEl.textContent = fab ? "FABRICATOR" : "SURVEY LOG · FIELD CRAFTING";
    (this.root.querySelector(".craft-head") as HTMLElement).textContent = fab
      ? "Fabricator · Tier 1"
      : "Hand Crafting · Tier 0";
  }

  hide(): void {
    this.visible = false;
    this.root.classList.add("hidden");
  }

  update(inv: Inventory, crafting: Crafting, knowledge: Knowledge): void {
    this.weightEl.textContent = `${inv.currentWeight.toFixed(1)} / ${inv.maxWeight} kg`;

    // Inventory column.
    this.invList.innerHTML = "";
    if (inv.stacks.length === 0) {
      this.invList.appendChild(li("empty", "— empty —"));
    }
    for (const stack of inv.stacks) {
      const item = getItem(stack.itemId);
      const dur =
        stack.durability !== undefined && item.maxDurability !== undefined
          ? ` <small>${Math.ceil(stack.durability)}/${item.maxDurability}</small>`
          : "";
      const row = document.createElement("li");
      row.innerHTML = `<span class="i-name">${item.name}${dur}</span><span class="i-qty">x${stack.quantity}</span>`;
      this.invList.appendChild(row);
    }

    // Recipe / repair column.
    this.recipeList.innerHTML = "";
    if (this.station === CraftingStation.Fabricator) this.renderRepairs(inv, crafting);

    const recipes = crafting.available(this.station, knowledge);
    if (recipes.length === 0) {
      this.recipeList.appendChild(
        li(
          "empty",
          this.station === CraftingStation.Fabricator
            ? "No recipes discovered — gather Tier-1 materials"
            : "—",
        ),
      );
    }
    for (const recipe of recipes) {
      const can = crafting.canCraft(recipe, inv);
      const item = document.createElement("li");
      item.className = `recipe ${can ? "craftable" : ""}`;
      const ings = recipe.ingredients
        .map((ing) => {
          const have = inv.count(ing.itemId);
          const ok = have >= ing.quantity;
          return `<span class="ing ${ok ? "ok" : "no"}">${getItem(ing.itemId).name} ${have}/${ing.quantity}</span>`;
        })
        .join(" · ");
      item.innerHTML = `
        <div class="r-head">
          <span class="r-name">${recipe.name}</span>
          <button class="r-btn" ${can ? "" : "disabled"}>Craft</button>
        </div>
        <div class="r-ings">${ings}</div>`;
      (item.querySelector(".r-btn") as HTMLButtonElement).addEventListener("click", () =>
        this.onCraft(recipe.id),
      );
      this.recipeList.appendChild(item);
    }
  }

  private renderRepairs(inv: Inventory, crafting: Crafting): void {
    const damaged = inv.stacks.filter((s) => {
      const item = getItem(s.itemId);
      return s.durability !== undefined && item.maxDurability !== undefined && s.durability < item.maxDurability;
    });
    if (damaged.length === 0) return;

    this.recipeList.appendChild(li("subhead", "Repair (+50 durability)"));
    for (const stack of damaged) {
      const item = getItem(stack.itemId);
      const recipe = crafting.recipeForOutput(stack.itemId);
      const cost = recipe?.ingredients ?? [];
      const affordable = cost.every((ing) => inv.has(ing.itemId, ing.quantity));
      const costStr = cost
        .map((ing) => {
          const ok = inv.count(ing.itemId) >= ing.quantity;
          return `<span class="ing ${ok ? "ok" : "no"}">${getItem(ing.itemId).name} ${ing.quantity}</span>`;
        })
        .join(" · ");
      const row = document.createElement("li");
      row.className = `recipe ${affordable ? "craftable" : ""}`;
      row.innerHTML = `
        <div class="r-head">
          <span class="r-name">${item.name} <small>${Math.ceil(stack.durability!)}/${item.maxDurability}</small></span>
          <button class="r-btn" ${affordable ? "" : "disabled"}>Repair</button>
        </div>
        <div class="r-ings">${costStr || "no recipe"}</div>`;
      (row.querySelector(".r-btn") as HTMLButtonElement).addEventListener("click", () =>
        this.onRepair(stack.itemId),
      );
      this.recipeList.appendChild(row);
    }
  }
}

function li(cls: string, text: string): HTMLLIElement {
  const node = document.createElement("li");
  node.className = cls;
  node.textContent = text;
  return node;
}
