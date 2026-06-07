import { ItemCategory } from "../core/types";
import { AUGMENT_BY_ID, AUGMENT_BY_ITEM } from "../data/augments";
import { getItem } from "../data/items";
import type { AugmentSystem } from "../systems/Augments";
import type { Inventory } from "../systems/Inventory";

/** GDD §8.2 — Medical Station panel: install/uninstall passive augments. */
export class AugmentUI {
  readonly root: HTMLDivElement;
  visible = false;
  onInstall: (augId: string) => void = () => {};
  onUninstall: (augId: string) => void = () => {};

  private readonly installedList: HTMLUListElement;
  private readonly availList: HTMLUListElement;
  private readonly slotsEl: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "aug-panel hidden";
    this.root.innerHTML = `
      <div class="panel-head">MEDICAL STATION · AUGMENTS <span class="hint">[E] / [Tab] close</span></div>
      <div class="panel-body">
        <div class="col">
          <h3>Installed <span class="weight slots"></span></h3>
          <ul class="recipe-list installed-list"></ul>
        </div>
        <div class="col">
          <h3>Available</h3>
          <ul class="recipe-list avail-list"></ul>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.installedList = this.root.querySelector(".installed-list")!;
    this.availList = this.root.querySelector(".avail-list")!;
    this.slotsEl = this.root.querySelector(".slots")!;
  }

  open(): void {
    this.visible = true;
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.visible = false;
    this.root.classList.add("hidden");
  }

  update(inv: Inventory, aug: AugmentSystem): void {
    this.slotsEl.textContent = `${aug.usedSlots()} / ${aug.maxSlots} slots`;

    // Installed
    this.installedList.innerHTML = "";
    const ids = aug.installedIds;
    if (ids.length === 0) this.installedList.appendChild(empty("— none installed —"));
    for (const id of ids) {
      const def = AUGMENT_BY_ID[id];
      const li = document.createElement("li");
      li.className = "recipe craftable";
      li.innerHTML = `
        <div class="r-head">
          <span class="r-name">${def.name} <small>${def.slotCost} slot${def.slotCost > 1 ? "s" : ""}</small></span>
          <button class="r-btn">Remove</button>
        </div>
        <div class="r-ings">${def.description}</div>`;
      (li.querySelector(".r-btn") as HTMLButtonElement).addEventListener("click", () =>
        this.onUninstall(id),
      );
      this.installedList.appendChild(li);
    }

    // Available (augment items held but not installed)
    this.availList.innerHTML = "";
    const held = inv.stacks.filter((s) => getItem(s.itemId).category === ItemCategory.Augment);
    if (held.length === 0) this.availList.appendChild(empty("— no augments held —"));
    for (const stack of held) {
      const def = AUGMENT_BY_ITEM[stack.itemId];
      if (!def) continue;
      const can = aug.canInstall(def.id);
      const li = document.createElement("li");
      li.className = `recipe ${can.ok ? "craftable" : ""}`;
      li.innerHTML = `
        <div class="r-head">
          <span class="r-name">${def.name} <small>${def.slotCost} slot${def.slotCost > 1 ? "s" : ""}</small></span>
          <button class="r-btn" ${can.ok ? "" : "disabled"}>${can.ok ? "Install" : can.reason}</button>
        </div>
        <div class="r-ings">${def.description}</div>`;
      const btn = li.querySelector(".r-btn") as HTMLButtonElement;
      if (can.ok) btn.addEventListener("click", () => this.onInstall(def.id));
      this.availList.appendChild(li);
    }
  }
}

function empty(text: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = text;
  return li;
}
