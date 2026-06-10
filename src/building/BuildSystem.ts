import * as THREE from "three";
import { CONFIG } from "../config";
import { terrainHeight } from "../core/math";
import {
  ModuleType,
  type BaseProvider,
  type Ingredient,
} from "../core/types";
import { MODULES, MODULE_BY_TYPE, type ModuleDef } from "../data/modules";
import { Inventory } from "../systems/Inventory";
import type { World } from "../world/World";

const CELL = CONFIG.build.cell;
const HALF = CELL / 2;
const FLOOR = CONFIG.build.floor;
/** Height of a foundation slab's walkable top above the module's base y
 * (slab is BoxGeometry(CELL, 0.3, CELL) sitting at local y 0.15 — see modules.ts). */
const FOUNDATION_TOP = 0.3;

export interface PlacedModule {
  id: number;
  type: ModuleType;
  def: ModuleDef;
  object: THREE.Object3D;
  cx: number;
  cz: number;
  level: number;
  side: number; // edge index for walls/doors, else -1
  yaw: number;
  topY: number; // walkable surface (foundations); base y otherwise
  powered: boolean;
  integrity: number;
  storage?: Inventory;
  water?: number; // condenser water charge
  charge?: number; // Veil-cell Battery stored charge (W·s)
  fuel?: number; // Generator fuel reserve
  growth?: number; // Planter crop progress in seconds (-1 = nothing planted)
}

/** Serialisable form of a placed module for the save file. */
export interface ModuleSave {
  type: ModuleType;
  cx: number;
  cz: number;
  level: number;
  side: number;
  yaw: number;
  integrity: number;
  storage?: { itemId: string; quantity: number }[];
  water?: number;
  charge?: number;
  fuel?: number;
  growth?: number;
}

interface Segment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  half: number;
}

interface Pending {
  cx: number;
  cz: number;
  side: number;
  level: number;
  yaw: number;
  pos: THREE.Vector3;
  placementOk: boolean;
  affordable: boolean;
  reason: string;
}

/**
 * GDD §6 — modular snap-grid base building. Implements `BaseProvider` so the
 * World can ask it for walkable foundation surfaces and wall collisions.
 */
export class BuildSystem implements BaseProvider {
  active = false;
  readonly placed: PlacedModule[] = [];

  private index = 0;
  private rotationSteps = 0;
  private nextId = 1;
  private poweredCount = 0;
  private grid: {
    status: "STABLE" | "OVERLOADED" | "OFFLINE";
    output: number;
    draw: number;
    batteryFrac: number;
    hasInfra: boolean;
  } = { status: "OFFLINE", output: 0, draw: 0, batteryFrac: 0, hasInfra: false };

  private ghost: THREE.Object3D | null = null;
  private ghostMeshes: THREE.Mesh[] = [];
  private pending: Pending | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly center = new THREE.Vector2(0, 0);

  // Derived collision/surface data, rebuilt on every placement.
  private wallSegments: Segment[] = [];
  private propCylinders: { x: number; z: number; r: number }[] = [];
  private foundationTops: { cx: number; cz: number; topY: number }[] = [];
  private surfaceObjects: THREE.Object3D[] = [];
  // Cached fire-pit positions (warmth / safe-zone / music queries run every frame).
  private readonly fireCache: { x: number; z: number }[] = [];
  // Cached Perimeter Spike positions (base-defense damage check runs every frame).
  private readonly spikeCache: { x: number; z: number }[] = [];
  /** Bumped whenever placed modules change, so per-frame callers can cache derived lists. */
  structureVersion = 0;

  /** Cached fire-pit positions, rebuilt only on placement change. */
  get firePositions(): { x: number; z: number }[] {
    return this.fireCache;
  }

  /** Cached Perimeter Spike positions, rebuilt only on placement change. */
  get spikePositions(): { x: number; z: number }[] {
    return this.spikeCache;
  }

  private readonly ghostValid = new THREE.MeshStandardMaterial({
    color: 0x3fe6c8,
    emissive: 0x1f7a68,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private readonly ghostInvalid = new THREE.MeshStandardMaterial({
    color: 0xff5a4d,
    emissive: 0x7a1f1a,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });

  constructor(
    private readonly world: World,
    private readonly inventory: Inventory,
  ) {
    this.surfaceObjects = [world.groundMesh];
    world.setBaseProvider(this);
  }

  // --- mode + selection -----------------------------------------------------

  toggle(): boolean {
    this.active = !this.active;
    if (this.active) this.rebuildGhost();
    else this.clearGhost();
    return this.active;
  }

  exit(): void {
    this.active = false;
    this.clearGhost();
  }

  cycle(dir: number): void {
    this.index = (this.index + dir + MODULES.length) % MODULES.length;
    this.rotationSteps = 0;
    this.rebuildGhost();
  }

  rotate(): void {
    this.rotationSteps = (this.rotationSteps + 1) % 4;
  }

  get currentDef(): ModuleDef {
    return MODULES[this.index];
  }

  // --- per-frame ghost update ----------------------------------------------

  update(camera: THREE.Camera): void {
    if (!this.active || !this.ghost) return;
    this.raycaster.setFromCamera(this.center, camera);
    this.raycaster.far = CONFIG.build.reach;
    const hit = this.raycaster.intersectObjects(this.surfaceObjects, true)[0];

    if (!hit) {
      this.pending = null;
      this.ghost.visible = false;
      return;
    }
    this.ghost.visible = true;
    this.pending = this.computePending(hit.point);

    this.ghost.position.copy(this.pending.pos);
    this.ghost.rotation.y = this.pending.yaw;
    const ok = this.pending.placementOk && this.pending.affordable;
    for (const m of this.ghostMeshes) m.material = ok ? this.ghostValid : this.ghostInvalid;
  }

  /** Try to place the current module. Returns a short status for the HUD. */
  place(): { ok: boolean; def: ModuleDef; reason: string; poweredCount: number } {
    const def = this.currentDef;
    if (!this.pending || !this.pending.placementOk) {
      return { ok: false, def, reason: this.pending?.reason ?? "No target", poweredCount: 0 };
    }
    if (!this.pending.affordable) {
      return { ok: false, def, reason: "Need materials", poweredCount: 0 };
    }
    for (const ing of def.cost) this.inventory.remove(ing.itemId, ing.quantity);
    this.spawnModule(def, this.pending);
    this.recomputeDerived();
    return { ok: true, def, reason: "", poweredCount: this.poweredCount };
  }

  // --- BaseProvider ---------------------------------------------------------

  surfaceHeight(x: number, z: number): number {
    let best = -Infinity;
    for (const f of this.foundationTops) {
      if (
        x >= f.cx * CELL - HALF &&
        x <= f.cx * CELL + HALF &&
        z >= f.cz * CELL - HALF &&
        z <= f.cz * CELL + HALF
      ) {
        if (f.topY > best) best = f.topY;
      }
    }
    return best;
  }

  resolveWalls(pos: { x: number; z: number }, radius: number): void {
    for (const s of this.wallSegments) {
      const dx = s.x2 - s.x1;
      const dz = s.z2 - s.z1;
      const len2 = dx * dx + dz * dz || 1e-6;
      const t = Math.max(0, Math.min(1, ((pos.x - s.x1) * dx + (pos.z - s.z1) * dz) / len2));
      const cx = s.x1 + dx * t;
      const cz = s.z1 + dz * t;
      const nx = pos.x - cx;
      const nz = pos.z - cz;
      const minD = radius + s.half;
      const d2 = nx * nx + nz * nz;
      if (d2 < minD * minD && d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos.x = cx + (nx / d) * minD;
        pos.z = cz + (nz / d) * minD;
      }
    }
    for (const c of this.propCylinders) {
      const nx = pos.x - c.x;
      const nz = pos.z - c.z;
      const minD = radius + c.r;
      const d2 = nx * nx + nz * nz;
      if (d2 < minD * minD && d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (nx / d) * minD;
        pos.z = c.z + (nz / d) * minD;
      }
    }
  }

  // --- queries for HUD / interaction ---------------------------------------

  buildState(): {
    name: string;
    cost: { name: string; have: number; need: number; ok: boolean }[];
    valid: boolean;
    reason: string;
  } {
    const def = this.currentDef;
    const cost = def.cost.map((ing) => {
      const have = this.inventory.count(ing.itemId);
      return { name: ing.itemId, have, need: ing.quantity, ok: have >= ing.quantity };
    });
    const valid = !!this.pending && this.pending.placementOk && this.pending.affordable;
    const reason = this.pending
      ? this.pending.placementOk
        ? this.pending.affordable
          ? "Ready"
          : "Need materials"
        : this.pending.reason
      : "No target";
    return { name: def.name, cost, valid, reason };
  }

  /** Top-level objects the player can interact with (pod / crate / damaged shell). */
  interactables(): THREE.Object3D[] {
    // Damaged structural pieces (no interact of their own) become repairable.
    return this.placed
      .filter((m) => m.def.interact || (isStructural(m.type) && m.integrity < 100))
      .map((m) => m.object);
  }

  /** GDD §6.1/§6.4 — weather wears structural pieces; at 0 integrity they collapse. */
  onCollapse: (name: string) => void = () => {};
  updateIntegrity(dt: number, stormIntensity: number, surgeIntensity: number): void {
    const perSec =
      (CONFIG.integrity.stormDamagePerMin / 60) * stormIntensity +
      (CONFIG.integrity.surgeDamagePerMin / 60) * surgeIntensity;
    if (perSec <= 0) return;
    let collapsed = false;
    for (let i = this.placed.length - 1; i >= 0; i--) {
      const m = this.placed[i];
      if (!isStructural(m.type)) continue;
      m.integrity -= perSec * dt;
      if (m.integrity <= 0) {
        this.onCollapse(m.def.name);
        this.disposeObject(m.object);
        this.placed.splice(i, 1);
        collapsed = true;
      }
    }
    if (collapsed) this.recomputeDerived();
  }

  // --- save / load ----------------------------------------------------------

  serialize(): ModuleSave[] {
    return this.placed.map((m) => ({
      type: m.type,
      cx: m.cx,
      cz: m.cz,
      level: m.level,
      side: m.side,
      yaw: m.yaw,
      integrity: m.integrity,
      storage: m.storage ? m.storage.stacks.map((s) => ({ ...s })) : undefined,
      water: m.water,
      charge: m.charge,
      fuel: m.fuel,
      growth: m.growth,
    }));
  }

  load(saves: ModuleSave[]): void {
    this.clearAll();
    for (const s of saves) {
      const def = MODULE_BY_TYPE[s.type];
      if (!def) continue;
      this.spawnModule(def, {
        cx: s.cx,
        cz: s.cz,
        side: s.side,
        level: s.level,
        yaw: s.yaw,
        pos: this.placementPos(def, s.cx, s.cz, s.side, s.level),
        placementOk: true,
        affordable: true,
        reason: "",
      }, s.storage);
      const last = this.placed[this.placed.length - 1];
      if (typeof s.integrity === "number") last.integrity = s.integrity;
      if (typeof s.water === "number") last.water = s.water;
      if (typeof s.charge === "number") last.charge = s.charge;
      if (typeof s.fuel === "number") last.fuel = s.fuel;
      if (typeof s.growth === "number") last.growth = s.growth;
    }
    this.recomputeDerived();
  }

  clearAll(): void {
    for (const m of this.placed) this.disposeObject(m.object);
    this.placed.length = 0;
    this.recomputeDerived();
  }

  // --- internals ------------------------------------------------------------

  private computePending(point: THREE.Vector3): Pending {
    const def = this.currentDef;
    const cx = Math.round(point.x / CELL);
    const cz = Math.round(point.z / CELL);
    let side = -1;
    let level = 0;
    let placementOk = true;
    let reason = "Ready";

    if (def.snap === "edge") {
      side = this.edgeFromPoint(point, cx, cz);
      if (!this.foundationAt(cx, cz)) {
        placementOk = false;
        reason = "Needs a foundation";
      } else if (this.wallAt(cx, cz, side)) {
        placementOk = false;
        reason = "Edge occupied";
      }
    } else if (def.snap === "cell") {
      if (this.foundationAt(cx, cz)) {
        placementOk = false;
        reason = "Cell occupied";
      }
    } else if (def.snap === "roof") {
      level = 1;
      if (!this.foundationAt(cx, cz)) {
        placementOk = false;
        reason = "Needs a foundation";
      } else if (this.roofAt(cx, cz)) {
        placementOk = false;
        reason = "Roof occupied";
      }
    } else {
      // prop
      if (this.propAt(cx, cz)) {
        placementOk = false;
        reason = "Spot occupied";
      }
    }

    const yaw = def.snap === "edge" ? yawForSide(side) : this.rotationSteps * (Math.PI / 2);
    const pos = this.placementPos(def, cx, cz, side, level);
    const affordable = this.canAfford(def.cost);
    return { cx, cz, side, level, yaw, pos, placementOk, affordable, reason };
  }

  private placementPos(def: ModuleDef, cx: number, cz: number, side: number, level: number): THREE.Vector3 {
    const centerX = cx * CELL;
    const centerZ = cz * CELL;
    const foundation = this.foundationAt(cx, cz);
    const surface = foundation ? foundation.topY : terrainHeight(centerX, centerZ);

    if (def.snap === "edge") {
      const baseY = foundation ? foundation.topY : surface;
      switch (side) {
        case 0:
          return new THREE.Vector3(centerX, baseY, centerZ + HALF);
        case 1:
          return new THREE.Vector3(centerX + HALF, baseY, centerZ);
        case 2:
          return new THREE.Vector3(centerX, baseY, centerZ - HALF);
        default:
          return new THREE.Vector3(centerX - HALF, baseY, centerZ);
      }
    }
    if (def.snap === "roof") {
      return new THREE.Vector3(centerX, surface + FLOOR * level, centerZ);
    }
    if (def.snap === "cell") {
      // Auto-level to neighbouring foundations so a multi-tile platform stays
      // flat instead of stepping with the terrain slope (GDD §6.1).
      const levelTop = this.adjacentFoundationTop(cx, cz);
      const y = levelTop !== null ? levelTop - FOUNDATION_TOP : terrainHeight(centerX, centerZ);
      return new THREE.Vector3(centerX, y, centerZ);
    }
    // prop sits on the surface (foundation top or terrain)
    return new THREE.Vector3(centerX, surface, centerZ);
  }

  private spawnModule(def: ModuleDef, p: Pending, storageStacks?: { itemId: string; quantity: number }[]): void {
    const object = def.create();
    object.position.copy(p.pos);
    object.rotation.y = p.yaw;
    this.world.scene.add(object);

    const topY =
      def.type === ModuleType.Foundation ? p.pos.y + FOUNDATION_TOP : p.pos.y;
    const module: PlacedModule = {
      id: this.nextId++,
      type: def.type,
      def,
      object,
      cx: p.cx,
      cz: p.cz,
      level: p.level,
      side: p.side,
      yaw: p.yaw,
      topY,
      powered: false,
      integrity: 100,
    };
    if (def.interact === "storage") {
      module.storage = new Inventory(CONFIG.build.storageWeight);
      if (storageStacks) for (const s of storageStacks) module.storage.stacks.push({ ...s });
    }
    if (def.type === ModuleType.Condenser) module.water = 0;
    if (def.type === ModuleType.Battery) module.charge = 0;
    if (def.type === ModuleType.Generator) module.fuel = 0;
    if (def.type === ModuleType.Planter) module.growth = -1; // empty bed
    object.userData.placedModule = module;
    this.placed.push(module);
  }

  private recomputeDerived(): void {
    this.wallSegments = [];
    this.propCylinders = [];
    this.foundationTops = [];
    this.surfaceObjects = [this.world.groundMesh];
    this.fireCache.length = 0;
    this.spikeCache.length = 0;

    for (const m of this.placed) {
      if (m.type === ModuleType.FirePit) {
        this.fireCache.push({ x: m.object.position.x, z: m.object.position.z });
      }
      if (m.type === ModuleType.PerimeterSpike) {
        this.spikeCache.push({ x: m.object.position.x, z: m.object.position.z });
      }
      if (m.type === ModuleType.Foundation) {
        this.foundationTops.push({ cx: m.cx, cz: m.cz, topY: m.topY });
        this.surfaceObjects.push(m.object);
      } else if (m.type === ModuleType.Roof) {
        this.surfaceObjects.push(m.object);
      } else if (m.type === ModuleType.Wall) {
        this.wallSegments.push(this.wallSegment(m, 0));
      } else if (m.type === ModuleType.Doorway) {
        this.wallSegments.push(...this.doorSegments(m));
      } else if (m.def.collision === "cylinder") {
        this.propCylinders.push({ x: m.cx * CELL, z: m.cz * CELL, r: 0.6 });
      }
    }
    this.structureVersion++;
  }

  private wallSegment(m: PlacedModule, shrink: number): Segment {
    const cxw = m.cx * CELL;
    const czw = m.cz * CELL;
    const end = HALF - shrink;
    if (m.side === 0 || m.side === 2) {
      const z = czw + (m.side === 0 ? HALF : -HALF);
      return { x1: cxw - end, z1: z, x2: cxw + end, z2: z, half: 0.14 };
    }
    const x = cxw + (m.side === 1 ? HALF : -HALF);
    return { x1: x, z1: czw - end, x2: x, z2: czw + end, half: 0.14 };
  }

  private doorSegments(m: PlacedModule): Segment[] {
    const cxw = m.cx * CELL;
    const czw = m.cz * CELL;
    const gap = 0.5; // half-width of the walkable opening
    if (m.side === 0 || m.side === 2) {
      const z = czw + (m.side === 0 ? HALF : -HALF);
      return [
        { x1: cxw - HALF, z1: z, x2: cxw - gap, z2: z, half: 0.14 },
        { x1: cxw + gap, z1: z, x2: cxw + HALF, z2: z, half: 0.14 },
      ];
    }
    const x = cxw + (m.side === 1 ? HALF : -HALF);
    return [
      { x1: x, z1: czw - HALF, x2: x, z2: czw - gap, half: 0.14 },
      { x1: x, z1: czw + gap, x2: x, z2: czw + HALF, half: 0.14 },
    ];
  }

  /**
   * GDD §6.3/§6.4 — per-frame power grid. Sources (Power Node trickle, day-only
   * Solar Panels, fuel-burning Generators, and Battery discharge) supply a watt
   * budget; consumers (Condenser / Medical Station / Light Post) draw from it.
   * Surplus charges batteries; a deficit discharges them. A consumer is powered
   * only when the grid is STABLE, it's within range of power infrastructure, and
   * there's no Ion-surge blackout. One base-wide grid (prototype simplification).
   */
  updatePower(dt: number, daylight: number, blackout: boolean): void {
    const P = CONFIG.power;
    let genOut = 0;
    let draw = 0;
    let cap = 0;
    let hasInfra = false;
    const batteries: PlacedModule[] = [];
    for (const m of this.placed) {
      switch (m.type) {
        case ModuleType.PowerNode:
          genOut += P.nodeOutput;
          hasInfra = true;
          break;
        case ModuleType.SolarPanel:
          genOut += P.solarOutput * daylight;
          hasInfra = true;
          break;
        case ModuleType.Generator:
          hasInfra = true;
          if ((m.fuel ?? 0) > 0) {
            genOut += P.genOutput;
            m.fuel = Math.max(0, (m.fuel ?? 0) - P.genFuelPerSec * dt);
          }
          break;
        case ModuleType.Battery:
          hasInfra = true;
          batteries.push(m);
          cap += P.batteryCapacity;
          break;
        case ModuleType.Condenser:
          draw += P.condenserDraw;
          hasInfra = true;
          break;
        case ModuleType.MedicalStation:
          draw += P.medicalDraw;
          hasInfra = true;
          break;
        case ModuleType.LightPost:
          draw += P.lightDraw;
          hasInfra = true;
          break;
      }
    }

    let status: "STABLE" | "OVERLOADED" | "OFFLINE";
    if (blackout) {
      status = "OFFLINE";
    } else if (genOut >= draw) {
      status = "STABLE";
      this.chargeBatteries(batteries, (genOut - draw) * dt, P.batteryCapacity);
    } else {
      const need = (draw - genOut) * dt;
      const drawn = this.dischargeBatteries(batteries, need);
      status = drawn >= need - 1e-6 ? "STABLE" : "OVERLOADED";
    }

    const ok = status === "STABLE";
    let count = 0;
    for (const m of this.placed) {
      if (
        m.type === ModuleType.Condenser ||
        m.type === ModuleType.MedicalStation ||
        m.type === ModuleType.LightPost
      ) {
        m.powered = ok && this.nearPowerSource(m);
        if (m.powered) count++;
        // The Light Post only shines while powered.
        if (m.type === ModuleType.LightPost) {
          m.object.traverse((o) => {
            const l = o as THREE.PointLight;
            if (l.isLight) l.visible = m.powered;
          });
        }
      } else {
        m.powered = false;
      }
    }
    this.poweredCount = count;

    let charge = 0;
    for (const b of batteries) charge += b.charge ?? 0;
    this.grid = {
      status,
      output: genOut,
      draw,
      batteryFrac: cap > 0 ? charge / cap : 0,
      hasInfra,
    };
  }

  /** Grid status snapshot for the HUD. */
  gridState(): {
    status: "STABLE" | "OVERLOADED" | "OFFLINE";
    output: number;
    draw: number;
    batteryFrac: number;
    hasInfra: boolean;
  } {
    return this.grid;
  }

  private chargeBatteries(bs: PlacedModule[], amount: number, capEach: number): void {
    for (const b of bs) {
      if (amount <= 0) break;
      const room = capEach - (b.charge ?? 0);
      const add = Math.min(room, amount);
      b.charge = (b.charge ?? 0) + add;
      amount -= add;
    }
  }

  private dischargeBatteries(bs: PlacedModule[], amount: number): number {
    let drawn = 0;
    for (const b of bs) {
      if (amount <= 0) break;
      const avail = Math.min(b.charge ?? 0, amount);
      b.charge = (b.charge ?? 0) - avail;
      amount -= avail;
      drawn += avail;
    }
    return drawn;
  }

  /** True if (consumer) m is within power-radius of any power source/relay. */
  private nearPowerSource(m: PlacedModule): boolean {
    const r2 = CONFIG.build.powerRadius * CONFIG.build.powerRadius;
    return this.placed.some((s) => {
      if (
        s.type !== ModuleType.PowerNode &&
        s.type !== ModuleType.SolarPanel &&
        s.type !== ModuleType.Battery &&
        s.type !== ModuleType.Generator
      ) {
        return false;
      }
      const dx = (m.cx - s.cx) * CELL;
      const dz = (m.cz - s.cz) * CELL;
      return dx * dx + dz * dz <= r2;
    });
  }

  private foundationAt(cx: number, cz: number): PlacedModule | undefined {
    return this.placed.find((m) => m.type === ModuleType.Foundation && m.cx === cx && m.cz === cz);
  }
  /** Highest walkable top among the 8 neighbouring foundation cells, or null if
   * the cell is isolated. New foundations level to this so connected tiles form
   * one flat platform rather than stepping with the terrain. */
  private adjacentFoundationTop(cx: number, cz: number): number | null {
    let top = -Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const f = this.foundationAt(cx + dx, cz + dz);
        if (f && f.topY > top) top = f.topY;
      }
    }
    return top === -Infinity ? null : top;
  }
  private roofAt(cx: number, cz: number): PlacedModule | undefined {
    return this.placed.find((m) => m.type === ModuleType.Roof && m.cx === cx && m.cz === cz);
  }
  private wallAt(cx: number, cz: number, side: number): PlacedModule | undefined {
    return this.placed.find(
      (m) =>
        (m.type === ModuleType.Wall || m.type === ModuleType.Doorway) &&
        m.cx === cx &&
        m.cz === cz &&
        m.side === side,
    );
  }
  private propAt(cx: number, cz: number): PlacedModule | undefined {
    return this.placed.find((m) => m.def.snap === "prop" && m.cx === cx && m.cz === cz);
  }

  private edgeFromPoint(point: THREE.Vector3, cx: number, cz: number): number {
    const dx = point.x - cx * CELL;
    const dz = point.z - cz * CELL;
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 3;
    return dz > 0 ? 0 : 2;
  }

  private canAfford(cost: Ingredient[]): boolean {
    return cost.every((ing) => this.inventory.has(ing.itemId, ing.quantity));
  }

  private rebuildGhost(): void {
    this.clearGhost();
    const obj = this.currentDef.create();
    this.ghostMeshes = [];
    obj.traverse((child) => {
      if ((child as THREE.Light).isLight) {
        (child as THREE.Light).intensity = 0;
      } else if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = this.ghostValid;
        this.ghostMeshes.push(mesh);
      }
    });
    obj.visible = false;
    this.ghost = obj;
    this.world.scene.add(obj);
  }

  private clearGhost(): void {
    if (this.ghost) {
      this.world.scene.remove(this.ghost);
      this.ghost.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      this.ghost = null;
      this.ghostMeshes = [];
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    this.world.scene.remove(obj);
    obj.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
        else mat.dispose();
      }
    });
  }
}

function yawForSide(side: number): number {
  return side === 1 || side === 3 ? Math.PI / 2 : 0;
}

/** Structural shell pieces — the ones weather wears down (GDD §6.1). */
function isStructural(type: ModuleType): boolean {
  return (
    type === ModuleType.Foundation ||
    type === ModuleType.Wall ||
    type === ModuleType.Doorway ||
    type === ModuleType.Roof
  );
}
