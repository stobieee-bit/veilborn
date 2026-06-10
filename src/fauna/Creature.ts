import * as THREE from "three";
import { CONFIG } from "../config";
import { BehaviorState, DetectionType, type CreatureDef } from "../core/types";
import type { World } from "../world/World";

export interface CreatureContext {
  playerPos: THREE.Vector3;
  playerCrouching: boolean;
  playerVeil: number;
  isNight: boolean;
  world: World;
  damagePlayer: (amount: number) => void;
  /** True when the player has lingered in the Spinewoods past the GDD threshold. */
  lingerAmbush: boolean;
  /** GDD §9.4 — the apex has adapted to the player's melee (block + resist). */
  apexAdapted: boolean;
  /** GDD §16 — Passive difficulty: creatures never hunt the player. */
  passive: boolean;
  /** GDD §10.1 — active decoy canister position (fauna investigate it). */
  lure?: THREE.Vector3 | null;
  /** GDD §10.1 — active flare position (fauna refuse to approach it). */
  repel?: THREE.Vector3 | null;
}

const tmp = new THREE.Vector3();

/**
 * A single fauna instance with the GDD §9.3 behaviour FSM. Supports ground
 * walkers, floating drifters, ambushers, callers and phasing stalkers.
 */
export class Creature {
  readonly def: CreatureDef;
  readonly mesh: THREE.Group;
  readonly pos: THREE.Vector3;
  readonly home: THREE.Vector3;
  health: number;
  state: BehaviorState = BehaviorState.Patrol;
  alive = true;
  hasCalled = false;
  phasedOut = false; // untargetable while a phasing creature is faded
  blocking = false; // adapted apex briefly negates melee (GDD §9.4)
  private blockTimer = 0;

  private wanderTarget = new THREE.Vector3();
  private wanderTimer = 0;
  private alertTimer = 0;
  private fleeTimer = 0;
  private attackTimer = 0;
  private animPhase = 0;
  private hitFlash = 0;
  private readonly floatHeight: number;
  private readonly legs: THREE.Mesh[] = [];
  private readonly allMats: THREE.Material[] = [];
  private body!: THREE.Mesh;
  private bodyMat!: THREE.MeshStandardMaterial;
  private bodyBaseY = 0.62;
  private baseEmissive = 0x000000;
  private baseEmissiveIntensity = 0;

  constructor(def: CreatureDef, spawn: THREE.Vector3, home: THREE.Vector3) {
    this.def = def;
    this.health = def.maxHealth;
    this.pos = spawn.clone();
    this.home = home.clone();
    this.floatHeight = def.floatHeight ?? 0;

    const group = new THREE.Group();
    if (def.id === "C03") this.buildDrifter(group);
    else if (def.id === "C06") this.buildWraith(group);
    else this.buildQuadruped(group, def.id);
    group.position.copy(this.pos);
    this.mesh = group;
    this.pickWanderTarget();
  }

  takeDamage(amount: number, fromDir: THREE.Vector3, knockback: number): void {
    if (!this.alive) return;
    this.health -= amount;
    this.hitFlash = 0.18;
    this.pos.addScaledVector(fromDir, knockback);
    if (this.health <= 0) {
      this.alive = false;
      return;
    }
    if (this.def.fleeHealthFrac > 0 && this.health < this.def.maxHealth * this.def.fleeHealthFrac) {
      this.state = BehaviorState.Flee;
      this.fleeTimer = 4;
    } else if (this.state === BehaviorState.Patrol || this.state === BehaviorState.Idle) {
      this.state = BehaviorState.Chase;
    }
  }

  get isAggressive(): boolean {
    return (
      this.state === BehaviorState.Alert ||
      this.state === BehaviorState.Chase ||
      this.state === BehaviorState.Attack
    );
  }

  alertTo(): void {
    if (this.alive && this.state === BehaviorState.Patrol) {
      this.state = BehaviorState.Alert;
      this.alertTimer = 0.4;
    }
  }

  update(dt: number, ctx: CreatureContext): void {
    if (!this.alive) return;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    // Adapted apex cycles a block window where melee glances off (GDD §9.4).
    if (this.def.isApex && ctx.apexAdapted) {
      this.blockTimer += dt;
      this.blocking = this.blockTimer % CONFIG.adaptation.blockPeriodSec < CONFIG.adaptation.blockWindowSec;
    } else {
      this.blocking = false;
    }

    const distToPlayer = Math.hypot(
      ctx.playerPos.x - this.pos.x,
      ctx.playerPos.z - this.pos.z,
    );
    // GDD §9.3 — detection modality shapes the effective sight range.
    let detect = this.def.detectionRange;
    switch (this.def.detectionType) {
      case DetectionType.Veil:
        // Veil-hunters see poorly; they sense the Veil instead (veilDrawn below).
        detect *= ctx.playerCrouching ? 0.4 : 0.6;
        break;
      case DetectionType.Combined:
        // Apex: keen senses — crouching helps less than against pure sight.
        detect *= ctx.playerCrouching ? 0.6 : 1;
        break;
      default: // Sight / Sound
        detect *= ctx.playerCrouching ? 0.5 : 1;
    }
    const veilDrawn =
      this.def.veilDrawThreshold !== undefined && ctx.playerVeil > this.def.veilDrawThreshold;

    let target: THREE.Vector3 | null = null;
    let speed = 0;

    // GDD §10.1 gadgets — flares repel, decoys lure. Apex are too cunning for both.
    if (!this.def.isApex) {
      if (ctx.repel) {
        const dr = Math.hypot(ctx.repel.x - this.pos.x, ctx.repel.z - this.pos.z);
        if (dr < CONFIG.gadgets.flareRepelRadius) {
          tmp.set(this.pos.x * 2 - ctx.repel.x, 0, this.pos.z * 2 - ctx.repel.z);
          this.moveToward(dt, tmp, this.def.fleeSpeed || this.def.chaseSpeed);
          this.state = BehaviorState.Patrol; // light breaks the hunt
          this.pos.y = ctx.world.groundHeight(this.pos.x, this.pos.z) + this.floatHeight;
          this.mesh.position.copy(this.pos);
          this.animate(dt, true);
          return;
        }
      }
      if (ctx.lure) {
        const dl = Math.hypot(ctx.lure.x - this.pos.x, ctx.lure.z - this.pos.z);
        if (dl < CONFIG.gadgets.decoyLureRadius) {
          this.state = BehaviorState.Patrol; // the noise wins over the player
          if (dl > 2.2) {
            tmp.set(ctx.lure.x, 0, ctx.lure.z);
            this.moveToward(dt, tmp, this.def.chaseSpeed * 0.85);
          } else {
            this.faceTo(ctx.lure as THREE.Vector3);
          }
          this.pos.y = ctx.world.groundHeight(this.pos.x, this.pos.z) + this.floatHeight;
          this.mesh.position.copy(this.pos);
          this.animate(dt, dl > 2.2);
          return;
        }
      }
    }

    switch (this.state) {
      case BehaviorState.Idle:
      case BehaviorState.Patrol: {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) this.pickWanderTarget();
        target = this.wanderTarget;
        speed = this.def.patrolSpeed;
        if (ctx.passive) break; // GDD §16 Passive — never hunt
        if (veilDrawn && distToPlayer < detect * 2.5) {
          this.state = BehaviorState.Chase; // drawn to high Veil Exposure
        } else if (this.def.ambush) {
          if (distToPlayer <= (this.def.ambushRange ?? 9) || ctx.lingerAmbush) {
            this.state = BehaviorState.Chase;
          }
        } else if (distToPlayer < detect) {
          this.state = BehaviorState.Alert;
          this.alertTimer = 0.4;
        }
        break;
      }
      case BehaviorState.Alert: {
        this.alertTimer -= dt;
        this.faceTo(ctx.playerPos);
        if (this.alertTimer <= 0) this.state = BehaviorState.Chase;
        break;
      }
      case BehaviorState.Chase: {
        target = ctx.playerPos;
        speed = this.def.chaseSpeed;
        if (distToPlayer <= this.def.attackRange) this.state = BehaviorState.Attack;
        else if (distToPlayer > detect * 1.8 && !veilDrawn) this.state = BehaviorState.Patrol;
        break;
      }
      case BehaviorState.Attack: {
        this.faceTo(ctx.playerPos);
        if (distToPlayer > this.def.attackRange * 1.15) {
          this.state = BehaviorState.Chase;
        } else if (this.attackTimer <= 0 && !this.phasedOut) {
          ctx.damagePlayer(this.def.attackDamage);
          this.attackTimer = this.def.attackCooldown;
        }
        break;
      }
      case BehaviorState.Flee: {
        this.fleeTimer -= dt;
        target = tmp.copy(this.pos).sub(ctx.playerPos).add(this.pos);
        speed = this.def.fleeSpeed;
        if (this.fleeTimer <= 0) this.state = BehaviorState.Patrol;
        break;
      }
    }

    if (target && speed > 0) this.moveToward(dt, target, speed);
    this.pos.y = ctx.world.groundHeight(this.pos.x, this.pos.z) + this.floatHeight;
    this.mesh.position.copy(this.pos);
    this.animate(dt, speed > 0);
  }

  rollLoot(): { itemId: string; qty: number }[] {
    const out: { itemId: string; qty: number }[] = [];
    for (const entry of this.def.loot) {
      if (Math.random() > entry.chance) continue;
      const qty = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
      if (qty > 0) out.push({ itemId: entry.itemId, qty });
    }
    return out;
  }

  // --- movement --------------------------------------------------------------

  private moveToward(dt: number, target: THREE.Vector3, speed: number): void {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const step = Math.min(speed * dt, d);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    const lim = 498;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
    this.faceDir(dx, dz);
  }

  private faceTo(p: THREE.Vector3): void {
    this.faceDir(p.x - this.pos.x, p.z - this.pos.z);
  }

  private faceDir(dx: number, dz: number): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    this.mesh.rotation.y = Math.atan2(-dx, -dz);
  }

  private pickWanderTarget(): void {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 8;
    this.wanderTarget.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
    this.wanderTimer = 2 + Math.random() * 3;
  }

  private animate(dt: number, moving: boolean): void {
    this.animPhase += dt * (moving ? 9 : 2.2);
    if (this.legs.length) {
      const swing = moving ? Math.sin(this.animPhase) * 0.5 : 0;
      this.legs[0].rotation.x = swing;
      this.legs[1].rotation.x = -swing;
      this.legs[2].rotation.x = -swing;
      this.legs[3].rotation.x = swing;
      this.body.position.y = this.bodyBaseY + (moving ? Math.abs(Math.sin(this.animPhase)) * 0.04 : 0);
    } else {
      this.body.position.y = this.bodyBaseY + Math.sin(this.animPhase * 0.6) * 0.12;
    }

    if (this.hitFlash > 0) {
      this.bodyMat.emissive.setHex(0xff2a1a);
      this.bodyMat.emissiveIntensity = 1.2;
    } else if (this.blocking) {
      this.bodyMat.emissive.setHex(0x6fd0ff);
      this.bodyMat.emissiveIntensity = 1.3;
    } else {
      this.bodyMat.emissive.setHex(this.baseEmissive);
      this.bodyMat.emissiveIntensity = this.baseEmissiveIntensity;
    }

    if (this.def.phasing) {
      const op = 0.12 + 0.88 * (0.5 + 0.5 * Math.sin(this.animPhase * 0.9));
      this.phasedOut = op < 0.35;
      for (const m of this.allMats) (m as THREE.MeshStandardMaterial).opacity = op;
    }
  }

  // --- mesh builders ---------------------------------------------------------

  private buildQuadruped(group: THREE.Group, id: string): void {
    const isSpineback = id === "C02";
    const isBellower = id === "C05";
    const isCrawler = id === "C04";
    const isCradle = id === "C07";
    const bodyColor = isSpineback
      ? 0x2f4a44
      : isBellower
        ? 0x5a3a3a
        : isCrawler
          ? 0x4a221a
          : isCradle
            ? 0x3a1410
            : 0x5a6470;
    const eyeColor =
      isSpineback ? 0x3fe6c8 : isCrawler || isCradle ? 0xff401c : isBellower ? 0xff3020 : 0xff6a2a;

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });
    this.allMats.push(this.bodyMat);
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 1.05), this.bodyMat);
    this.bodyBaseY = 0.62;
    this.body.position.y = this.bodyBaseY;
    group.add(this.body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), this.bodyMat);
    head.position.set(0, 0.68, -0.66);
    group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a04,
      emissive: eyeColor,
      emissiveIntensity: 1.4,
    });
    this.allMats.push(eyeMat);
    for (const ex of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
      eye.position.set(ex, 0.72, -0.86);
      group.add(eye);
    }

    const legGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
    for (const lx of [-0.18, 0.18])
      for (const lz of [-0.34, 0.36]) {
        const leg = new THREE.Mesh(legGeo, this.bodyMat);
        leg.position.set(lx, 0.25, lz);
        group.add(leg);
        this.legs.push(leg);
      }

    if (isSpineback) {
      const spineMat = new THREE.MeshStandardMaterial({
        color: 0x14302b,
        emissive: 0x2f8a7a,
        emissiveIntensity: 0.4,
        flatShading: true,
      });
      for (let i = 0; i < 4; i++) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), spineMat);
        spine.position.set(0, 0.86, -0.35 + i * 0.24);
        group.add(spine);
      }
      group.scale.set(1.2, 0.78, 1.35);
    } else if (isBellower) {
      const throat = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a0c0c, emissive: 0xff5a30, emissiveIntensity: 1.0 }),
      );
      throat.position.set(0, 0.55, -0.74);
      group.add(throat);
      group.scale.setScalar(1.7);
    } else if (isCrawler) {
      group.scale.set(0.72, 0.55, 0.9); // small, low-slung swarm creature
    } else if (isCradle) {
      // A glowing crest + a massive, dark frame for the apex.
      const crest = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4, 0),
        new THREE.MeshStandardMaterial({ color: 0x2a0a06, emissive: 0xff401c, emissiveIntensity: 1.3 }),
      );
      crest.position.set(0, 1.05, -0.1);
      group.add(crest);
      group.scale.setScalar(2.4);
    }
  }

  private buildDrifter(group: THREE.Group): void {
    this.baseEmissive = 0x3fe6c8;
    this.baseEmissiveIntensity = 0.85;
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x123a3a,
      emissive: this.baseEmissive,
      emissiveIntensity: this.baseEmissiveIntensity,
      transparent: true,
      opacity: 0.8,
      roughness: 0.4,
      flatShading: true,
    });
    this.allMats.push(this.bodyMat);
    this.body = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      this.bodyMat,
    );
    this.bodyBaseY = 0;
    group.add(this.body);

    const tendrilMat = new THREE.MeshStandardMaterial({
      color: 0x0c2a2a,
      emissive: 0x2fc0b0,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
    });
    this.allMats.push(tendrilMat);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9, 4), tendrilMat);
      t.position.set(Math.cos(a) * 0.45, -0.5, Math.sin(a) * 0.45);
      t.rotation.x = Math.PI;
      group.add(t);
    }
  }

  private buildWraith(group: THREE.Group): void {
    this.baseEmissive = 0x6f3fd0;
    this.baseEmissiveIntensity = 0.4;
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x14121c,
      emissive: this.baseEmissive,
      emissiveIntensity: this.baseEmissiveIntensity,
      transparent: true,
      opacity: 0.85,
      roughness: 0.6,
      flatShading: true,
    });
    this.allMats.push(this.bodyMat);
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.55, 2.3, 6), this.bodyMat);
    this.bodyBaseY = 1.15;
    this.body.position.y = this.bodyBaseY;
    group.add(this.body);

    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), this.bodyMat);
    head.position.y = 2.4;
    group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0030,
      emissive: 0xbf6fff,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 1,
    });
    this.allMats.push(eyeMat);
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
      eye.position.set(ex, 2.42, -0.22);
      group.add(eye);
    }
  }
}
