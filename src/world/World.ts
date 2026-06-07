import * as THREE from "three";
import { CONFIG } from "../config";
import {
  CRADLE,
  SPINEWOODS,
  VEIL_SINK,
  WARRENS,
  cradleFactor,
  spinewoodsFactor,
  veilSinkFactor,
  warrensFactor,
} from "../core/biomes";
import { clamp, hash2, terrainHeight } from "../core/math";
import type { BaseProvider } from "../core/types";
import { SkyDome } from "./SkyDome";

export type NodeKind =
  | "ore"
  | "frond"
  | "spore"
  | "water"
  | "crystal"
  | "resin"
  | "wreck"
  | "bio"
  | "condensate";

/** A harvestable / interactable world feature. */
export interface ResourceNode {
  id: string;
  mesh: THREE.Mesh;
  kind: NodeKind;
  label: string;
  promptVerb: string; // "Gather" | "Drink"
  yieldItemId: string | null; // null for water
  yieldMin: number;
  yieldMax: number;
  drinkAmount: number; // hydration restored (water only)
  remaining: number; // harvests left (Infinity for water)
  initialRemaining: number; // for New Game reset
}

interface Collider {
  x: number;
  z: number;
  r: number;
}

/**
 * The Ashfields greybox (GDD B01) — a 1km x 1km handcrafted-feel terrain with
 * instanced rock/crystal scatter, gatherable resource nodes, simple cylinder
 * collision and the lighting rig that DayNightCycle animates.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly sky: SkyDome;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  readonly fog: THREE.FogExp2;

  readonly resourceNodes: ResourceNode[] = [];
  // Cached list of currently-gatherable node meshes for the interaction raycast,
  // rebuilt only when a node depletes/resets (avoids a per-frame filter+map).
  private readonly gatherMeshes: THREE.Mesh[] = [];
  private gatherDirty = true;
  readonly veilLights: THREE.PointLight[] = [];
  /** Biome-local point lights culled by player distance (GDD §17 Phase 12 perf:
   * forward rendering uploads every visible light to every material, so distant
   * Warrens/Cradle pools cost on every fragment unless switched off). */
  private readonly cullableLights: { light: THREE.PointLight; x: number; z: number; onR2: number }[] = [];
  groundMesh!: THREE.Mesh;
  readonly cradleSignalPos = new THREE.Vector3(); // signal array landmark
  signalArrayObject!: THREE.Object3D; // interactable (Ending A repair)

  private readonly colliders: Collider[] = [];
  private readonly crystalMaterial: THREE.MeshStandardMaterial;
  private readonly shelterGroup = new THREE.Group();
  private baseProvider: BaseProvider | null = null;

  constructor() {
    const size = CONFIG.world.size;

    this.sky = new SkyDome(size * 0.9);
    this.scene.add(this.sky.mesh);

    this.fog = new THREE.FogExp2(0xb98a5a, CONFIG.world.fogDensityDay);
    this.scene.fog = this.fog;

    // --- Lighting rig (animated by DayNightCycle) ---
    this.hemi = new THREE.HemisphereLight(0xd8a36a, 0x3a352f, 0.6);
    this.scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x404858, 0.25);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffd9a0, 1.4);
    this.sun.position.set(60, 120, 30);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.crystalMaterial = new THREE.MeshStandardMaterial({
      color: 0x12313a,
      emissive: 0x2fe0c0,
      emissiveIntensity: 0.0,
      roughness: 0.35,
      metalness: 0.1,
      flatShading: true,
    });

    this.buildTerrain();
    this.buildRockScatter();
    this.buildCrystalScatter();
    this.buildSpinewoodsTrees();
    this.buildVeilSinkProps();
    this.buildWarrens();
    this.buildCradle();
    this.buildResourceNodes();

    this.scene.add(this.shelterGroup);
  }

  /** Registers the base building system as a surface/collision provider. */
  setBaseProvider(provider: BaseProvider): void {
    this.baseProvider = provider;
  }

  groundHeight(x: number, z: number): number {
    const terrain = terrainHeight(x, z);
    const surface = this.baseProvider ? this.baseProvider.surfaceHeight(x, z) : -Infinity;
    return surface > terrain ? surface : terrain;
  }

  /** Push `pos` out of colliders (cylinders + base walls); clamp to bounds. */
  resolveHorizontal(pos: THREE.Vector3, radius: number): void {
    for (const c of this.colliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minDist = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < minDist * minDist && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = minDist - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      }
    }
    if (this.baseProvider) this.baseProvider.resolveWalls(pos, radius);
    const lim = CONFIG.world.size / 2 - 3;
    pos.x = clamp(pos.x, -lim, lim);
    pos.z = clamp(pos.z, -lim, lim);
  }

  /** Set Veil-matter glow strength (0 day .. 1 deep night). */
  setVeilGlow(intensity: number): void {
    this.crystalMaterial.emissiveIntensity = intensity * 1.6;
    for (const l of this.veilLights) l.intensity = intensity * 6;
  }

  /**
   * GDD §17 Phase 12 perf — switch biome-local point lights off when the player
   * is far. In forward rendering an invisible light is dropped from the shader
   * light list, so this shrinks the per-fragment lighting loop everywhere else
   * (e.g. 17 → 8 active lights while in the Ashfields).
   */
  updateBiomeLights(x: number, z: number): void {
    for (const c of this.cullableLights) {
      const d2 = (x - c.x) ** 2 + (z - c.z) ** 2;
      c.light.visible = d2 < c.onR2;
    }
  }

  /** Deploy a Tier-0 shelter prop at a position (placeholder for Phase 2). */
  placeShelter(x: number, z: number, yaw: number): void {
    const y = this.groundHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = yaw;

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x6b5c44,
      roughness: 1,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x3d6b5a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });

    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6);
    for (const px of [-0.9, 0.9]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 0.8, 0.9);
      group.add(post);
    }
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), roofMat);
    roof.rotation.x = -Math.PI / 2.6;
    roof.position.set(0, 1.25, 0.1);
    group.add(roof);

    this.shelterGroup.add(group);
    this.colliders.push({ x, z, r: 1.2 });
  }

  // --- construction helpers -------------------------------------------------

  private buildTerrain(): void {
    const size = CONFIG.world.size;
    const seg = CONFIG.world.terrainSegments;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const ash = new THREE.Color(0x6f6a63);
    const spine = new THREE.Color(0x2e3d3a); // darker, bluer Spinewoods floor
    const sink = new THREE.Color(0x1c2a3a); // deep Veil Sink floor
    const warren = new THREE.Color(0x3a2a22); // warm rock Warrens floor
    const cradle = new THREE.Color(0x402018); // scorched Cradle ground
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      // Tint toward each biome palette inside its region.
      col
        .copy(ash)
        .lerp(spine, spinewoodsFactor(x, z))
        .lerp(sink, veilSinkFactor(x, z))
        .lerp(warren, warrensFactor(x, z))
        .lerp(cradle, cradleFactor(x, z));
      const tint = 0.92 + hash2(x * 0.5, z * 0.5) * 0.12 + h * 0.004;
      colors.push(col.r * tint, col.g * tint, col.b * tint);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.groundMesh = ground;
    this.scene.add(ground);
  }

  private buildRockScatter(): void {
    const size = CONFIG.world.size;
    const half = size / 2;
    const spacing = 28;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7d756b,
      roughness: 1.0,
      metalness: 0.0,
      flatShading: true,
      vertexColors: false,
    });

    const dummy = new THREE.Object3D();
    const transforms: { x: number; z: number; s: number }[] = [];
    for (let gx = -half + spacing; gx < half; gx += spacing) {
      for (let gz = -half + spacing; gz < half; gz += spacing) {
        if (hash2(gx * 1.7, gz * 2.3) < 0.55) continue;
        const x = gx + (hash2(gx * 3.1, gz) * 2 - 1) * spacing * 0.45;
        const z = gz + (hash2(gx, gz * 3.7) * 2 - 1) * spacing * 0.45;
        if (Math.hypot(x, z) < 16) continue; // keep the spawn clearing open
        const s = 0.6 + hash2(x, z) * 3.0;
        transforms.push({ x, z, s });
      }
    }

    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
    transforms.forEach((t, i) => {
      const y = this.groundHeight(t.x, t.z) + t.s * 0.35;
      dummy.position.set(t.x, y, t.z);
      dummy.rotation.set(
        hash2(t.x, t.z * 2) * Math.PI,
        hash2(t.z, t.x * 2) * Math.PI,
        hash2(t.x * 2, t.z) * Math.PI,
      );
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (t.s > 1.9) this.colliders.push({ x: t.x, z: t.z, r: t.s * 0.8 });
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  private buildCrystalScatter(): void {
    const size = CONFIG.world.size;
    const half = size / 2;
    const spacing = 44;
    const geo = new THREE.OctahedronGeometry(1, 0);

    const dummy = new THREE.Object3D();
    const transforms: { x: number; z: number; s: number; h: number }[] = [];
    for (let gx = -half + spacing; gx < half; gx += spacing) {
      for (let gz = -half + spacing; gz < half; gz += spacing) {
        if (hash2(gx * 0.9 + 5, gz * 1.4 + 9) < 0.74) continue;
        const x = gx + (hash2(gx * 2.2, gz + 1) * 2 - 1) * spacing * 0.4;
        const z = gz + (hash2(gx + 1, gz * 2.6) * 2 - 1) * spacing * 0.4;
        if (Math.hypot(x, z) < 20) continue;
        const s = 0.5 + hash2(x + 7, z + 3) * 1.4;
        const h = 2.2 + hash2(x + 2, z + 8) * 4.5;
        transforms.push({ x, z, s, h });
      }
    }

    const mesh = new THREE.InstancedMesh(geo, this.crystalMaterial, transforms.length);
    transforms.forEach((t, i) => {
      const gy = this.groundHeight(t.x, t.z);
      dummy.position.set(t.x, gy + t.h * 0.45, t.z);
      dummy.rotation.set(0, hash2(t.x, t.z) * Math.PI, 0);
      dummy.scale.set(t.s, t.h, t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);

    // A few real point lights at the nearest crystals so night has pools of glow.
    const near = transforms
      .map((t) => ({ ...t, d: Math.hypot(t.x, t.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    for (const t of near) {
      const light = new THREE.PointLight(0x3fe6c8, 0, 40, 1.6);
      light.position.set(t.x, this.groundHeight(t.x, t.z) + t.h * 0.6, t.z);
      this.veilLights.push(light);
      this.scene.add(light);
    }
  }

  private buildSpinewoodsTrees(): void {
    const { cx, cz, outer } = SPINEWOODS;
    const spacing = 11;
    const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 1, 6); // unit height
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3a3330,
      roughness: 1,
      flatShading: true,
    });
    const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x183a36,
      emissive: 0x2f8a7a,
      emissiveIntensity: 0.4,
      roughness: 0.4,
      metalness: 0.1,
      flatShading: true,
    });

    const trees: { x: number; z: number; h: number; r: number; c: number }[] = [];
    for (let gx = cx - outer; gx <= cx + outer; gx += spacing) {
      for (let gz = cz - outer; gz <= cz + outer; gz += spacing) {
        const sf = spinewoodsFactor(gx, gz);
        if (sf < 0.35) continue;
        if (hash2(gx * 1.3, gz * 1.7) > sf) continue; // density scales with depth
        const x = gx + (hash2(gx * 2.1, gz) * 2 - 1) * spacing * 0.45;
        const z = gz + (hash2(gx, gz * 2.3) * 2 - 1) * spacing * 0.45;
        if (Math.abs(x) > CONFIG.world.size / 2 - 6) continue;
        if (Math.abs(z) > CONFIG.world.size / 2 - 6) continue;
        const h = 6 + hash2(x + 5, z) * 7;
        const r = 0.45 + hash2(x, z + 5) * 0.4;
        const c = 1.6 + hash2(x + 9, z + 9) * 1.6;
        trees.push({ x, z, h, r, c });
      }
    }

    const dummy = new THREE.Object3D();
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, trees.length);
    trees.forEach((t, i) => {
      const gy = this.groundHeight(t.x, t.z);
      dummy.position.set(t.x, gy + (t.h / 2) * 1, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(t.r, t.h, t.r);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, gy + t.h + t.c * 0.3, t.z);
      dummy.rotation.set(hash2(t.x, t.z) * 0.6, hash2(t.z, t.x) * Math.PI, 0);
      dummy.scale.set(t.c, t.c * 1.4, t.c);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);

      this.colliders.push({ x: t.x, z: t.z, r: t.r + 0.2 });
    });
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, canopies);
  }

  private buildVeilSinkProps(): void {
    const { cx, cz, outer } = VEIL_SINK;
    const spacing = 13;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x16203a,
      emissive: 0x6f3fd0,
      emissiveIntensity: 0.9,
      roughness: 0.4,
      flatShading: true,
    });
    const dummy = new THREE.Object3D();
    const pods: { x: number; z: number; s: number }[] = [];
    for (let gx = cx - outer; gx <= cx + outer; gx += spacing) {
      for (let gz = cz - outer; gz <= cz + outer; gz += spacing) {
        const sf = veilSinkFactor(gx, gz);
        if (sf < 0.3) continue;
        if (hash2(gx * 1.9 + 3, gz * 1.1 + 7) > sf) continue;
        const x = gx + (hash2(gx, gz * 3) * 2 - 1) * spacing * 0.45;
        const z = gz + (hash2(gx * 3, gz) * 2 - 1) * spacing * 0.45;
        pods.push({ x, z, s: 0.3 + hash2(x, z) * 0.6 });
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, pods.length);
    pods.forEach((p, i) => {
      dummy.position.set(p.x, this.groundHeight(p.x, p.z) + p.s * 0.5, p.z);
      dummy.rotation.set(hash2(p.x, p.z), hash2(p.z, p.x) * Math.PI, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  private buildWarrens(): void {
    const { cx, cz } = WARRENS;
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3a2f28,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    // Cave roof: a dark rock ring with a central shaft to drop through.
    const ceiling = new THREE.Mesh(new THREE.RingGeometry(16, 96, 40), rockMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, 9, cz);
    this.scene.add(ceiling);

    // Stalactites hanging from the roof.
    const dripGeo = new THREE.ConeGeometry(0.7, 4, 5);
    const drips = new THREE.InstancedMesh(dripGeo, rockMat, 40);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = hash2(i, 3) * Math.PI * 2;
      const r = 18 + hash2(i, 7) * 70;
      dummy.position.set(cx + Math.cos(a) * r, 9 - 2, cz + Math.sin(a) * r);
      dummy.rotation.set(Math.PI, 0, 0);
      dummy.scale.setScalar(0.5 + hash2(i, 11) * 0.9);
      dummy.updateMatrix();
      drips.setMatrixAt(i, dummy.matrix);
    }
    drips.instanceMatrix.needsUpdate = true;
    this.scene.add(drips);

    // Support columns (floor to roof) — solid, with collision.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4;
      const r = 28 + hash2(i, 5) * 45;
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      const gy = this.groundHeight(px, pz);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 11 - gy, 7), rockMat);
      col.position.set(px, (9 + gy) / 2, pz);
      col.scale.y = (9 - gy) / (11 - gy);
      this.scene.add(col);
      this.colliders.push({ x: px, z: pz, r: 2.0 });
    }

    // Dim pools of light so the dark pit is navigable.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = i === 0 ? 0 : 40;
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      const light = new THREE.PointLight(0xffb060, 4, 55, 1.5);
      light.position.set(px, this.groundHeight(px, pz) + 6, pz);
      light.visible = false; // culled on until the player nears the Warrens
      this.scene.add(light);
      this.cullableLights.push({ light, x: px, z: pz, onR2: 90 * 90 });
    }

    // Crawler nests — dark mounds with glowing eggs.
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2;
      const r = 30 + i * 12;
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      const gy = this.groundHeight(px, pz);
      const mound = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.2, 0),
        new THREE.MeshStandardMaterial({ color: 0x241712, roughness: 1, flatShading: true }),
      );
      mound.scale.y = 0.5;
      mound.position.set(px, gy + 0.5, pz);
      this.scene.add(mound);
      const eggMat = new THREE.MeshStandardMaterial({ color: 0x3a1008, emissive: 0xff5a2a, emissiveIntensity: 1.0 });
      for (let e = 0; e < 4; e++) {
        const egg = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), eggMat);
        egg.position.set(px + (hash2(e, i) * 2 - 1) * 1.3, gy + 0.5, pz + (hash2(i, e) * 2 - 1) * 1.3);
        this.scene.add(egg);
      }
    }

    // Condensate Crystal water source (GDD M008) on the Warrens floor.
    for (let i = 0; i < 10; i++) {
      const a = i * 2.399963;
      const r = 12 + (i / 10) * 55;
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      this.resourceNodes.push(this.makeNode("condensate", px, pz, `cond_w_${i}`));
    }
  }

  private buildCradle(): void {
    const { cx, cz } = CRADLE;
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x5e5247,
      roughness: 0.6,
      metalness: 0.7,
      flatShading: true,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x2a0a06,
      emissive: 0xff3a14,
      emissiveIntensity: 1.3,
      roughness: 0.5,
    });

    // The terraforming core — a broken tower at the heart of the impact zone.
    const gy = this.groundHeight(cx, cz);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 26, 8), hullMat);
    core.position.set(cx, gy + 12, cz);
    this.scene.add(core);
    this.colliders.push({ x: cx, z: cz, r: 6 });
    const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 6, 8), glowMat);
    coreGlow.position.set(cx, gy + 24, cz);
    this.scene.add(coreGlow);

    // Scattered hull wreckage ringing the core.
    for (let i = 0; i < 14; i++) {
      const a = i * 1.3;
      const r = 18 + hash2(i, cx) * 60;
      const px = cx + Math.cos(a) * r;
      const pz = cz + Math.sin(a) * r;
      const w = 4 + hash2(px, pz) * 8;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, w * 0.5), hullMat);
      slab.position.set(px, this.groundHeight(px, pz) + 1.2, pz);
      slab.rotation.set(hash2(px, i) - 0.5, hash2(i, pz) * Math.PI, hash2(px, pz) - 0.5);
      this.scene.add(slab);
      if (w > 7) this.colliders.push({ x: px, z: pz, r: w * 0.4 });
    }

    // Signal array — the story landmark (Ending A repair target, GDD §12.1).
    const arrayX = cx + 26;
    const arrayZ = cz + 18;
    const arrayY = this.groundHeight(arrayX, arrayZ);
    const array = new THREE.Group();
    array.position.set(arrayX, arrayY, arrayZ);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 10, 6), hullMat);
    mast.position.y = 5;
    array.add(mast);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    );
    dish.rotation.x = -Math.PI / 3;
    dish.position.y = 9;
    array.add(dish);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x102b28, emissive: 0x3fe6c8, emissiveIntensity: 1.0 }),
    );
    beacon.position.y = 10.2;
    array.add(beacon);
    array.userData.signalArray = true;
    this.scene.add(array);
    this.signalArrayObject = array;
    this.cradleSignalPos.set(arrayX, arrayY, arrayZ);

    // Ominous red light pools.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const px = cx + Math.cos(a) * 30;
      const pz = cz + Math.sin(a) * 30;
      const light = new THREE.PointLight(0xff401c, 4, 60, 1.6);
      light.position.set(px, this.groundHeight(px, pz) + 8, pz);
      light.visible = false; // culled on until the player nears the Cradle
      this.scene.add(light);
      this.cullableLights.push({ light, x: px, z: pz, onR2: 95 * 95 });
    }
  }

  private buildResourceNodes(): void {
    this.scatterNodes("ore", 40, 22, 165, 0.0);
    this.scatterNodes("frond", 46, 14, 150, 2.0);
    this.scatterNodes("spore", 26, 18, 140, 4.0);
    this.scatterNodes("water", 14, 16, 150, 6.0);
    // GDD M002/M004/M005/M006/M008 — canonically other biomes; scattered through
    // the Ashfields here so all 8 core materials are gatherable in Phase 4.
    this.scatterNodes("crystal", 18, 40, 185, 8.0);
    this.scatterNodes("resin", 14, 55, 205, 10.0);
    this.scatterNodes("wreck", 12, 48, 210, 12.0);
    this.scatterNodes("bio", 16, 30, 190, 14.0);
    this.scatterNodes("condensate", 12, 65, 200, 16.0);
  }

  private scatterNodes(
    kind: NodeKind,
    count: number,
    minR: number,
    maxR: number,
    phase: number,
  ): void {
    const golden = 2.399963;
    for (let i = 0; i < count; i++) {
      const angle = i * golden + phase;
      const r = minR + (maxR - minR) * Math.sqrt((i + 0.5) / count);
      const jitter = (hash2(i + phase, i * 1.7 + phase) * 2 - 1) * 8;
      const x = Math.cos(angle) * r + jitter;
      const z = Math.sin(angle) * r + jitter * 0.5;
      this.resourceNodes.push(this.makeNode(kind, x, z, `${kind}_${i}`));
    }
  }

  private makeNode(kind: NodeKind, x: number, z: number, id: string): ResourceNode {
    const gy = this.groundHeight(x, z);
    let mesh: THREE.Mesh;
    const node: ResourceNode = {
      id,
      mesh: null as unknown as THREE.Mesh,
      kind,
      label: "",
      promptVerb: "Gather",
      yieldItemId: null,
      yieldMin: 1,
      yieldMax: 1,
      drinkAmount: 0,
      remaining: 1,
      initialRemaining: 1,
    };

    switch (kind) {
      case "ore": {
        mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.9, 0),
          new THREE.MeshStandardMaterial({
            color: 0x8a8a96,
            emissive: 0x223040,
            emissiveIntensity: 0.4,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.4, 1.0, 1.4);
        mesh.position.set(x, gy + 0.5, z);
        node.label = "Ash-sediment";
        node.yieldItemId = "ash_sediment";
        node.yieldMin = 2;
        node.yieldMax = 4;
        node.remaining = 4;
        break;
      }
      case "frond": {
        mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.8, 0),
          new THREE.MeshStandardMaterial({
            color: 0x4f7d4a,
            emissive: 0x123010,
            emissiveIntensity: 0.3,
            roughness: 0.9,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.1, 1.5, 1.1);
        mesh.position.set(x, gy + 0.6, z);
        node.label = "Fiber-frond";
        node.yieldItemId = "fiber_frond";
        node.yieldMin = 1;
        node.yieldMax = 3;
        node.remaining = 5;
        break;
      }
      case "spore": {
        mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.45, 0),
          new THREE.MeshStandardMaterial({
            color: 0xc56bd6,
            emissive: 0xa12fd0,
            emissiveIntensity: 0.9,
            roughness: 0.6,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.4, 0.9, 1.4);
        mesh.position.set(x, gy + 0.3, z);
        node.label = "Spore-cap";
        node.yieldItemId = "spore_cap";
        node.yieldMin = 1;
        node.yieldMax = 2;
        node.remaining = 3;
        break;
      }
      case "crystal": {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.6, 0),
          new THREE.MeshStandardMaterial({
            color: 0x2a6f8a,
            emissive: 0x39c6e0,
            emissiveIntensity: 0.7,
            roughness: 0.3,
            metalness: 0.2,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.0, 1.8, 1.0);
        mesh.position.set(x, gy + 0.7, z);
        node.label = "Spine-crystal Shard";
        node.yieldItemId = "spine_crystal_shard";
        node.yieldMin = 1;
        node.yieldMax = 2;
        node.remaining = 4;
        break;
      }
      case "resin": {
        mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.55, 0),
          new THREE.MeshStandardMaterial({
            color: 0x5a3a7a,
            emissive: 0x7a3fd0,
            emissiveIntensity: 0.6,
            roughness: 0.4,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.4, 0.8, 1.4);
        mesh.position.set(x, gy + 0.35, z);
        node.label = "Veil-resin";
        node.yieldItemId = "veil_resin";
        node.yieldMin = 1;
        node.yieldMax = 2;
        node.remaining = 4;
        break;
      }
      case "wreck": {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.8, 1.4),
          new THREE.MeshStandardMaterial({
            color: 0x6b6f74,
            emissive: 0x612a10,
            emissiveIntensity: 0.3,
            roughness: 0.6,
            metalness: 0.7,
            flatShading: true,
          }),
        );
        mesh.rotation.set(0.2, 0.6, 0.15);
        mesh.position.set(x, gy + 0.4, z);
        node.label = "Ship Alloy Scrap";
        node.yieldItemId = "ship_alloy_scrap";
        node.yieldMin = 1;
        node.yieldMax = 2;
        node.remaining = 3;
        break;
      }
      case "bio": {
        mesh = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.4, 0),
          new THREE.MeshStandardMaterial({
            color: 0x0c3a3a,
            emissive: 0x4ffce0,
            emissiveIntensity: 1.3,
            roughness: 0.5,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.3, 1.1, 1.3);
        mesh.position.set(x, gy + 0.35, z);
        node.label = "Bioluminite";
        node.yieldItemId = "bioluminite";
        node.yieldMin = 1;
        node.yieldMax = 2;
        node.remaining = 3;
        break;
      }
      case "condensate": {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5, 0),
          new THREE.MeshStandardMaterial({
            color: 0x7fb4d8,
            emissive: 0x3a7fae,
            emissiveIntensity: 0.5,
            roughness: 0.2,
            metalness: 0.3,
            flatShading: true,
          }),
        );
        mesh.scale.set(1.0, 1.2, 1.0);
        mesh.position.set(x, gy + 0.5, z);
        node.label = "Condensate Crystal";
        node.yieldItemId = "condensate_crystal";
        node.yieldMin = 1;
        node.yieldMax = 2;
        node.remaining = 4;
        break;
      }
      case "water":
      default: {
        mesh = new THREE.Mesh(
          new THREE.CircleGeometry(1.6, 20),
          new THREE.MeshStandardMaterial({
            color: 0x2a5b6e,
            emissive: 0x16414f,
            emissiveIntensity: 0.5,
            roughness: 0.15,
            metalness: 0.6,
          }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, gy + 0.06, z);
        node.label = "Veil Spring";
        node.promptVerb = "Drink";
        node.drinkAmount = 25;
        node.remaining = Infinity;
        break;
      }
    }

    node.initialRemaining = node.remaining;
    mesh.userData.resourceNode = node;
    node.mesh = mesh;
    this.scene.add(mesh);
    return node;
  }

  /** Meshes of currently-gatherable nodes (remaining > 0) for the interaction
   * raycast; rebuilt in place only when the set changes (see {@link gatherDirty}). */
  gatherableMeshes(): THREE.Mesh[] {
    if (this.gatherDirty) {
      this.gatherMeshes.length = 0;
      for (const n of this.resourceNodes) if (n.remaining > 0) this.gatherMeshes.push(n.mesh);
      this.gatherDirty = false;
    }
    return this.gatherMeshes;
  }

  /** Mark a node depleted: hide it but keep it for save/load persistence. */
  depleteNode(node: ResourceNode): void {
    node.remaining = 0;
    node.mesh.visible = false;
    this.gatherDirty = true;
  }

  /** Restore every node to its initial state (used by New Game). */
  resetNodes(): void {
    for (const node of this.resourceNodes) {
      node.remaining = node.initialRemaining;
      node.mesh.visible = true;
    }
    this.gatherDirty = true;
  }

  /** Snapshot of every node's remaining harvests, for the save file. */
  nodeStates(): { id: string; remaining: number }[] {
    return this.resourceNodes
      .filter((n) => Number.isFinite(n.remaining))
      .map((n) => ({ id: n.id, remaining: n.remaining }));
  }

  /** Restore node remaining-counts from a save (depleted ones get hidden). */
  applyNodeStates(states: { id: string; remaining: number }[]): void {
    const map = new Map(states.map((s) => [s.id, s.remaining]));
    for (const node of this.resourceNodes) {
      if (!Number.isFinite(node.remaining)) continue; // springs never deplete
      const remaining = map.get(node.id);
      if (remaining === undefined) continue;
      node.remaining = remaining;
      node.mesh.visible = remaining > 0;
    }
    this.gatherDirty = true;
  }
}
