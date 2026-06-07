import * as THREE from "three";
import type { LoreFragment } from "../core/types";
import { LORE_FRAGMENTS } from "../data/lore";
import type { World } from "../world/World";

/** GDD §12.2 — 47 fragments unlock the epilogue; Phase 5 places the first 15. */
export const TOTAL_FRAGMENTS = 47;

const shardMat = () =>
  new THREE.MeshStandardMaterial({
    color: 0x3a2a10,
    emissive: 0xffcf70,
    emissiveIntensity: 1.2,
    roughness: 0.4,
    flatShading: true,
  });

/** Tracks collected fragments and owns their floating world pickups. */
export class LoreSystem {
  private readonly found = new Set<string>();
  private readonly meshes = new Map<string, THREE.Object3D>();
  private t = 0;

  constructor(world: World) {
    for (const f of LORE_FRAGMENTS) {
      const obj = this.makeShard();
      const baseY = world.groundHeight(f.x, f.z) + 1.3;
      obj.position.set(f.x, baseY, f.z);
      obj.userData.loreFragment = f;
      obj.userData.baseY = baseY;
      obj.userData.phase = this.meshes.size * 1.3;
      world.scene.add(obj);
      this.meshes.set(f.id, obj);
    }
  }

  /** Un-collected fragment pickups (for the interaction raycast). */
  interactables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const m of this.meshes.values()) if (m.visible) out.push(m);
    return out;
  }

  collect(f: LoreFragment): void {
    this.found.add(f.id);
    const m = this.meshes.get(f.id);
    if (m) m.visible = false;
  }

  isFound(id: string): boolean {
    return this.found.has(id);
  }

  get foundCount(): number {
    return this.found.size;
  }

  get placedCount(): number {
    return LORE_FRAGMENTS.length;
  }

  /** Collected fragments (for the Survey Log archive), in fixed order. */
  collected(): LoreFragment[] {
    return LORE_FRAGMENTS.filter((f) => this.found.has(f.id));
  }

  blackBoxFound(): number {
    return LORE_FRAGMENTS.filter((f) => f.blackBox && this.found.has(f.id)).length;
  }

  uncollectedBlackBox(): LoreFragment[] {
    return LORE_FRAGMENTS.filter((f) => f.blackBox && !this.found.has(f.id));
  }

  update(dt: number): void {
    this.t += dt;
    for (const m of this.meshes.values()) {
      if (!m.visible) continue;
      m.rotation.y += dt * 1.2;
      m.position.y = m.userData.baseY + Math.sin(this.t * 2 + m.userData.phase) * 0.14;
    }
  }

  reset(): void {
    this.found.clear();
    for (const m of this.meshes.values()) m.visible = true;
  }

  serialize(): string[] {
    return [...this.found];
  }

  load(ids: string[]): void {
    this.found.clear();
    for (const m of this.meshes.values()) m.visible = true;
    for (const id of ids) {
      this.found.add(id);
      const m = this.meshes.get(id);
      if (m) m.visible = false;
    }
  }

  private makeShard(): THREE.Object3D {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), shardMat());
    g.add(core);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 4, 16),
      new THREE.MeshStandardMaterial({
        color: 0x3a2a10,
        emissive: 0xffb840,
        emissiveIntensity: 0.8,
        roughness: 0.5,
      }),
    );
    ring.rotation.x = Math.PI / 2.4;
    g.add(ring);
    return g;
  }
}
