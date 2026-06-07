import { CONFIG } from "../config";

/**
 * GDD §11.3 — the Topographic Mapper reveals terrain in a 100m radius as the
 * player explores. This tracks the explored grid (fog of war); the Minimap UI
 * renders it.
 */
export class MapSystem {
  readonly cell = 16; // metres per grid cell
  readonly worldSize = CONFIG.world.size;
  readonly grid: number;
  readonly explored: Uint8Array;

  constructor() {
    this.grid = Math.ceil(this.worldSize / this.cell);
    this.explored = new Uint8Array(this.grid * this.grid);
  }

  reveal(x: number, z: number, radius: number): void {
    const half = this.worldSize / 2;
    const cgx = Math.floor((x + half) / this.cell);
    const cgz = Math.floor((z + half) / this.cell);
    const rc = Math.ceil(radius / this.cell);
    for (let dz = -rc; dz <= rc; dz++) {
      for (let dx = -rc; dx <= rc; dx++) {
        if (dx * dx + dz * dz > rc * rc) continue;
        const gx = cgx + dx;
        const gz = cgz + dz;
        if (gx < 0 || gz < 0 || gx >= this.grid || gz >= this.grid) continue;
        this.explored[gz * this.grid + gx] = 1;
      }
    }
  }

  isExplored(gx: number, gz: number): boolean {
    return this.explored[gz * this.grid + gx] === 1;
  }

  reset(): void {
    this.explored.fill(0);
  }

  serialize(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.explored.length; i++) if (this.explored[i]) out.push(i);
    return out;
  }

  load(indices: number[]): void {
    this.explored.fill(0);
    for (const i of indices) if (i >= 0 && i < this.explored.length) this.explored[i] = 1;
  }
}
