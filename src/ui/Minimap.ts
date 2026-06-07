import { Biome, biomeAt } from "../core/biomes";
import type { MapSystem } from "../systems/MapSystem";

const SIZE = 168; // canvas px

/** GDD §11.3 — corner minimap revealed by the Topographic Mapper. */
export class Minimap {
  readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private biomeColors: string[] | null = null; // cached per-cell tint

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "minimap hidden";
    this.root.innerHTML = `<div class="mm-title">TOPO MAP</div>`;
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.root.appendChild(this.canvas);
    parent.appendChild(this.root);
    this.ctx = this.canvas.getContext("2d")!;
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  render(map: MapSystem, px: number, pz: number, yaw: number): void {
    const ctx = this.ctx;
    const grid = map.grid;
    const cellPx = SIZE / grid;
    const half = map.worldSize / 2;

    if (!this.biomeColors) this.cacheBiomeColors(map);
    const colors = this.biomeColors!;

    ctx.fillStyle = "#0a0c10";
    ctx.fillRect(0, 0, SIZE, SIZE);

    for (let gz = 0; gz < grid; gz++) {
      for (let gx = 0; gx < grid; gx++) {
        if (!map.isExplored(gx, gz)) continue;
        ctx.fillStyle = colors[gz * grid + gx];
        ctx.fillRect(gx * cellPx, gz * cellPx, cellPx + 0.5, cellPx + 0.5);
      }
    }

    // Player marker + heading.
    const mx = ((px + half) / map.worldSize) * SIZE;
    const mz = ((pz + half) / map.worldSize) * SIZE;
    const hx = mx - Math.sin(yaw) * 9;
    const hz = mz - Math.cos(yaw) * 9;
    ctx.strokeStyle = "#3fe6c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, mz);
    ctx.lineTo(hx, hz);
    ctx.stroke();
    ctx.fillStyle = "#3fe6c8";
    ctx.beginPath();
    ctx.arc(mx, mz, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private cacheBiomeColors(map: MapSystem): void {
    const grid = map.grid;
    const half = map.worldSize / 2;
    const colors: string[] = new Array(grid * grid);
    for (let gz = 0; gz < grid; gz++) {
      for (let gx = 0; gx < grid; gx++) {
        const wx = gx * map.cell - half + map.cell / 2;
        const wz = gz * map.cell - half + map.cell / 2;
        const b = biomeAt(wx, wz);
        colors[gz * grid + gx] =
          b === Biome.Spinewoods
            ? "#26403a"
            : b === Biome.VeilSink
              ? "#243349"
              : b === Biome.Warrens
                ? "#3a2a20"
                : "#6a6058";
      }
    }
    this.biomeColors = colors;
  }
}
