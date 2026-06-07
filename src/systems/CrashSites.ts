import * as THREE from "three";
import { CRASH_SITES, type CrashSite } from "../data/crashsites";
import { hash2 } from "../core/math";
import type { World } from "../world/World";

/**
 * Places the 3 crash-site POIs (debris + a one-time loot container) and tracks
 * which have been recovered (persisted in the save).
 */
export class CrashSites {
  private readonly recovered = new Set<string>();
  private readonly containers = new Map<string, THREE.Object3D>();

  constructor(world: World) {
    for (const site of CRASH_SITES) {
      this.buildDebris(world, site);
      const container = this.buildContainer(world, site);
      world.scene.add(container);
      this.containers.set(site.id, container);
    }
  }

  interactables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const c of this.containers.values()) if (c.visible) out.push(c);
    return out;
  }

  isRecovered(id: string): boolean {
    return this.recovered.has(id);
  }

  recover(site: CrashSite): void {
    this.recovered.add(site.id);
    const c = this.containers.get(site.id);
    if (c) c.visible = false;
  }

  reset(): void {
    this.recovered.clear();
    for (const c of this.containers.values()) c.visible = true;
  }

  serialize(): string[] {
    return [...this.recovered];
  }

  load(ids: string[]): void {
    this.recovered.clear();
    for (const c of this.containers.values()) c.visible = true;
    for (const id of ids) {
      this.recovered.add(id);
      const c = this.containers.get(id);
      if (c) c.visible = false;
    }
  }

  private buildDebris(world: World, site: CrashSite): void {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x6b6f74,
      roughness: 0.6,
      metalness: 0.7,
      flatShading: true,
    });
    // Scatter several large tilted hull plates around the site.
    for (let i = 0; i < 6; i++) {
      const a = i * 1.7;
      const r = 4 + hash2(site.x + i, site.z) * 6;
      const px = site.x + Math.cos(a) * r;
      const pz = site.z + Math.sin(a) * r;
      const w = 2 + hash2(px, pz) * 4;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, w * 0.6), hullMat);
      plate.position.set(px, world.groundHeight(px, pz) + 0.4, pz);
      plate.rotation.set(hash2(px, i) * 0.7 - 0.35, hash2(i, pz) * Math.PI, hash2(px, pz) * 0.7 - 0.35);
      group.add(plate);
    }
    world.scene.add(group);
  }

  private buildContainer(world: World, site: CrashSite): THREE.Object3D {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.8, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x4a4138, roughness: 0.7, metalness: 0.3 }),
    );
    body.position.y = 0.4;
    g.add(body);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x2a1a08,
        emissive: 0xffb030,
        emissiveIntensity: 1.3,
      }),
    );
    light.position.set(0, 0.55, 0.36);
    g.add(light);
    g.position.set(site.x, world.groundHeight(site.x, site.z), site.z);
    g.userData.crashSite = site;
    return g;
  }
}
