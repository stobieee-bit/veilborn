import { getItem } from "../data/items";
import type { Inventory } from "../systems/Inventory";

/**
 * Storage crate transfer panel: click a row to move that whole stack across
 * (limited by the destination's carry weight). Like the crafting menu, it is
 * only re-rendered on open and after each transfer — never per frame.
 */
export class StorageUI {
  readonly root: HTMLDivElement;
  visible = false;

  private player: Inventory | null = null;
  private crate: Inventory | null = null;
  private readonly youList: HTMLUListElement;
  private readonly crateList: HTMLUListElement;
  private readonly youWeight: HTMLSpanElement;
  private readonly crateWeight: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "storage-panel hidden";
    this.root.innerHTML = `
      <div class="panel-head">STORAGE CRATE <span class="hint">[E] / [Tab] close</span></div>
      <div class="panel-body">
        <div class="col">
          <h3>You <span class="weight you-weight"></span></h3>
          <ul class="inv-list you-list"></ul>
        </div>
        <div class="col">
          <h3>Crate <span class="weight crate-weight"></span></h3>
          <ul class="inv-list crate-list"></ul>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.youList = this.root.querySelector(".you-list")!;
    this.crateList = this.root.querySelector(".crate-list")!;
    this.youWeight = this.root.querySelector(".you-weight")!;
    this.crateWeight = this.root.querySelector(".crate-weight")!;
  }

  open(player: Inventory, crate: Inventory): void {
    this.player = player;
    this.crate = crate;
    this.visible = true;
    this.root.classList.remove("hidden");
    this.render();
  }

  close(): void {
    this.visible = false;
    this.root.classList.add("hidden");
    this.player = null;
    this.crate = null;
  }

  private transfer(from: Inventory, to: Inventory, itemId: string): void {
    const qty = from.count(itemId);
    const moved = to.add(itemId, qty);
    if (moved > 0) from.remove(itemId, moved);
    this.render();
  }

  private render(): void {
    if (!this.player || !this.crate) return;
    const player = this.player;
    const crate = this.crate;
    this.youWeight.textContent = `${player.currentWeight.toFixed(1)} / ${player.maxWeight} kg`;
    this.crateWeight.textContent = `${crate.currentWeight.toFixed(1)} / ${crate.maxWeight} kg`;
    this.fill(this.youList, player, () => crate, "▶");
    this.fill(this.crateList, crate, () => player, "◀");
  }

  private fill(
    list: HTMLUListElement,
    from: Inventory,
    to: () => Inventory,
    arrow: string,
  ): void {
    list.innerHTML = "";
    if (from.stacks.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "— empty —";
      list.appendChild(li);
      return;
    }
    for (const stack of from.stacks) {
      const item = getItem(stack.itemId);
      const li = document.createElement("li");
      li.className = "xfer";
      li.innerHTML = `<span class="i-name">${arrow} ${item.name}</span><span class="i-qty">x${stack.quantity}</span>`;
      li.addEventListener("click", () => this.transfer(from, to(), stack.itemId));
      list.appendChild(li);
    }
  }
}
