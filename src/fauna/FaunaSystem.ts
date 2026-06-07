import * as THREE from "three";
import { CONFIG } from "../config";
import { Biome, biomeAt } from "../core/biomes";
import {
  BELLOWER,
  CRADLE_SPAWN,
  CRAWLER,
  DRIFTER,
  SCOUT,
  SPINEBACK,
  VEIL_WRAITH,
} from "../data/creatures";
import { Creature, type CreatureContext } from "./Creature";
import type { World } from "../world/World";

export interface SafeZone {
  x: number;
  z: number;
  r: number;
}

export interface MeleeResult {
  hit: boolean;
  killed: boolean;
  blocked: boolean;
  name: string;
  loot: { itemId: string; qty: number }[];
  point?: THREE.Vector3; // world-space hit location (for impact FX)
}

const NONE: MeleeResult = { hit: false, killed: false, blocked: false, name: "", loot: [] };

/**
 * Manages Ashfields fauna (GDD §9.1): pack spawning away from safe zones,
 * per-creature FSM updates, pack alert propagation, and player melee resolution.
 */
export class FaunaSystem {
  readonly creatures: Creature[] = [];
  /** Invoked when a caller creature bellows (HUD / audio cue). */
  onBellow: () => void = () => {};
  /** GDD §9.4 — set by Game; apex melee resistance/blocking when adapted. */
  adaptedApex = false;
  /** GDD §9.1 — set by Game once enough apex have been defeated; stops respawns. */
  apexExhausted = false;
  onApexMeleeHit: (killed: boolean) => void = () => {};
  /** GDD §16 — spawn-interval multiplier (Infinity = no spawns / Passive). */
  spawnDelayMult = 1;
  private spawnTimer = 8; // first pack a few seconds in

  constructor(private readonly world: World) {}

  get count(): number {
    return this.creatures.length;
  }

  /** Number currently hunting the player (for the HUD threat cue). */
  get aggroCount(): number {
    return this.creatures.filter((c) => c.alive && c.isAggressive).length;
  }

  reset(): void {
    for (const c of this.creatures) this.world.scene.remove(c.mesh);
    this.creatures.length = 0;
    this.spawnTimer = 8;
  }

  update(dt: number, ctx: CreatureContext, safeZones: SafeZone[]): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.creatures.length < CONFIG.fauna.maxScouts) {
      this.spawnPack(ctx.playerPos, safeZones, ctx.playerVeil, ctx.isNight);
      this.spawnTimer = CONFIG.fauna.respawnDelaySec * this.spawnDelayMult;
    }

    for (const c of this.creatures) c.update(dt, ctx);

    // Bellower call: a caller that just turned aggressive rouses nearby fauna.
    for (const c of this.creatures) {
      if (!c.alive || !c.def.caller || c.hasCalled || !c.isAggressive) continue;
      c.hasCalled = true;
      const r2 = (c.def.callRadius ?? 50) ** 2;
      for (const other of this.creatures) {
        if (other !== c && other.alive && other.pos.distanceToSquared(c.pos) < r2) {
          other.alertTo();
        }
      }
      this.onBellow();
    }

    // Pack alert: a hunting scout rouses idle packmates nearby.
    const aggressors = this.creatures.filter((c) => c.alive && c.isAggressive);
    if (aggressors.length) {
      for (const c of this.creatures) {
        if (!c.alive || c.isAggressive) continue;
        for (const a of aggressors) {
          if (c.pos.distanceToSquared(a.pos) < 18 * 18) {
            c.alertTo();
            break;
          }
        }
      }
    }

    // Recycle dead, far-away, or (for night-only fauna) day-caught creatures.
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      const far = c.pos.distanceTo(ctx.playerPos) > CONFIG.fauna.despawnDist;
      const dayCaught = c.def.nightOnly === true && !ctx.isNight;
      if (!c.alive || far || dayCaught) {
        this.world.scene.remove(c.mesh);
        this.creatures.splice(i, 1);
      }
    }
  }

  /** Resolve a player melee swing; returns the closest creature hit in arc. */
  meleeHit(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    range: number,
    arcDot: number,
    damage: number,
    knockback: number,
  ): MeleeResult {
    let best: Creature | null = null;
    let bestDist = Infinity;
    const to = new THREE.Vector3();
    for (const c of this.creatures) {
      if (!c.alive || c.phasedOut) continue; // can't strike a phased-out wraith
      to.copy(c.pos).add(new THREE.Vector3(0, 0.6, 0)).sub(origin);
      const d = to.length();
      if (d > range) continue;
      to.normalize();
      if (to.dot(dir) < arcDot) continue;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (!best) return NONE;

    // GDD §9.4 — adapted apex resists melee and blocks it outright at times.
    let dmg = damage;
    if (best.def.isApex && this.adaptedApex) dmg *= CONFIG.adaptation.apexMeleeResist;
    const blocked = best.blocking;
    if (blocked) dmg = 0;

    const knock = new THREE.Vector3(best.pos.x - origin.x, 0, best.pos.z - origin.z).normalize();
    best.takeDamage(dmg, knock, knockback);
    if (best.def.isApex) this.onApexMeleeHit(!best.alive);
    const point = new THREE.Vector3(best.pos.x, best.pos.y + 0.6, best.pos.z);
    if (!best.alive) {
      const loot = best.rollLoot();
      this.world.scene.remove(best.mesh);
      this.creatures.splice(this.creatures.indexOf(best), 1);
      return { hit: true, killed: true, blocked, name: best.def.name, loot, point };
    }
    return { hit: true, killed: false, blocked, name: best.def.name, loot: [], point };
  }

  private spawnPack(
    playerPos: THREE.Vector3,
    safeZones: SafeZone[],
    playerVeil: number,
    isNight: boolean,
  ): void {
    const f = CONFIG.fauna;
    const lim = CONFIG.world.size / 2 - 10;
    let center: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = f.spawnMinDist + Math.random() * (f.spawnMaxDist - f.spawnMinDist);
      const x = playerPos.x + Math.cos(angle) * dist;
      const z = playerPos.z + Math.sin(angle) * dist;
      if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
      if (safeZones.some((s) => (x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r)) continue;
      center = new THREE.Vector3(x, 0, z);
      break;
    }
    if (!center) return;

    const room = f.maxScouts - this.creatures.length;
    if (room <= 0) return;

    // Composition by biome (GDD §9.2). Very high Veil Exposure draws a Drifter
    // toward the player anywhere (GDD §4.1 passive attraction).
    const biome = biomeAt(center.x, center.z);
    let def = SCOUT;
    let count: number = f.packSize;
    if (biome === Biome.Cradle) {
      // Apex — only one at a time (GDD §9.1 apex do not swarm), and they do not
      // respawn once enough have been defeated (finite world events).
      if (this.apexExhausted) return;
      if (this.creatures.some((c) => c.def.id === "C07")) return;
      def = CRADLE_SPAWN;
      count = 1;
    } else if (biome === Biome.Warrens) {
      def = CRAWLER;
      count = CONFIG.warrens.crawlerPackSize;
    } else if (biome === Biome.VeilSink) {
      if (isNight && Math.random() < 0.45) {
        def = VEIL_WRAITH;
        count = 1;
      } else {
        def = DRIFTER;
        count = 2;
      }
    } else if (playerVeil > CONFIG.veil.drifterDrawSpawn && Math.random() < 0.5) {
      def = DRIFTER;
      count = 1;
    } else if (Math.random() < (biome === Biome.Spinewoods ? 0.2 : 0.14)) {
      def = BELLOWER;
      count = 1;
    } else if (biome === Biome.Spinewoods) {
      def = SPINEBACK;
      count = 2;
    }
    count = Math.min(count, room);

    for (let i = 0; i < count; i++) {
      const ox = center.x + (Math.random() * 2 - 1) * 3;
      const oz = center.z + (Math.random() * 2 - 1) * 3;
      const spawn = new THREE.Vector3(ox, this.world.groundHeight(ox, oz), oz);
      const creature = new Creature(def, spawn, center);
      this.world.scene.add(creature.mesh);
      this.creatures.push(creature);
    }
  }
}
