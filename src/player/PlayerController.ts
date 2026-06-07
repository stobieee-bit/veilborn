import * as THREE from "three";
import { CONFIG } from "../config";
import { clamp, lerp } from "../core/math";
import type { SurvivalStats } from "../systems/SurvivalStats";
import type { World } from "../world/World";
import type { Input } from "./Input";

/**
 * GDD §17 Phase 1 — first-person controller: walk, sprint (stamina-gated),
 * crouch, jump, gravity and terrain-following ground collision. Owns the
 * camera and a simple held-tool viewmodel.
 */
export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  readonly position = new THREE.Vector3();

  private yaw = 0;
  private pitch = 0;
  private velocityY = 0;
  private eyeHeight: number = CONFIG.player.standEyeHeight;
  private grounded = true;
  private bobPhase = 0;
  private swingTimer = 0;
  private grappling = false;
  private grappleTimer = 0;
  private readonly grappleTarget = new THREE.Vector3();
  private toolMesh: THREE.Object3D | null = null;

  // Surfaced for stats/HUD each frame.
  isMoving = false;
  isSprinting = false;
  isCrouching = false;

  // Settings (GDD §16).
  private bobEnabled = true;
  private sprintToggleMode = false;
  private sprintLatched = false;

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  setHeadBob(on: boolean): void {
    this.bobEnabled = on;
  }
  setSprintToggle(on: boolean): void {
    this.sprintToggleMode = on;
    this.sprintLatched = false;
  }

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(90, aspect, 0.05, 2000);
    this.camera.rotation.order = "YXZ";
  }

  spawn(world: World): void {
    this.position.set(0, world.groundHeight(0, 0), 0);
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.eyeHeight = CONFIG.player.standEyeHeight;
    this.grounded = true;
    // Place the camera immediately so the intro screen renders the real view.
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z,
    );
    this.camera.rotation.set(0, 0, 0);
  }

  /** Direction the camera faces on the horizontal plane (for placement etc.). */
  get forwardYaw(): number {
    return this.yaw;
  }

  /** Snapshot of position + look angles for the save file. */
  getPose(): { x: number; y: number; z: number; yaw: number; pitch: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  /** Restore position + look angles from a save. */
  applyPose(p: { x: number; y: number; z: number; yaw: number; pitch: number }): void {
    this.position.set(p.x, p.y, p.z);
    this.yaw = p.yaw;
    this.pitch = p.pitch;
    this.velocityY = 0;
    this.grounded = false;
    this.camera.position.set(p.x, p.y + this.eyeHeight, p.z);
    this.camera.rotation.set(p.pitch, p.yaw, 0);
  }

  update(dt: number, input: Input, world: World, stats: SurvivalStats): void {
    const p = CONFIG.player;

    // --- Look ---
    if (input.locked) {
      const { dx, dy } = input.consumeMouse();
      this.yaw -= dx * p.mouseSensitivity;
      this.pitch -= dy * p.mouseSensitivity;
      this.pitch = clamp(this.pitch, -p.pitchClamp, p.pitchClamp);
    } else {
      input.consumeMouse(); // discard while unlocked
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // --- Grapple overrides normal locomotion while zipping to an anchor ---
    if (this.grappling) {
      this.updateGrapple(dt, world);
      this.camera.position.set(
        this.position.x,
        this.position.y + this.eyeHeight,
        this.position.z,
      );
      this.updateViewmodel(dt, false, 0);
      return;
    }

    // --- Desired horizontal movement ---
    const fwdInput =
      (input.isDown("KeyW") ? 1 : 0) - (input.isDown("KeyS") ? 1 : 0);
    const strafeInput =
      (input.isDown("KeyD") ? 1 : 0) - (input.isDown("KeyA") ? 1 : 0);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(forward, fwdInput)
      .addScaledVector(right, strafeInput);
    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();

    this.isCrouching = input.isDown("ControlLeft") || input.isDown("KeyC");
    if (this.sprintToggleMode) {
      if (input.wasPressed("ShiftLeft")) this.sprintLatched = !this.sprintLatched;
    } else {
      this.sprintLatched = input.isDown("ShiftLeft");
    }
    const wantSprint =
      this.sprintLatched && fwdInput > 0 && !this.isCrouching && moving && stats.canSprint;
    this.isSprinting = wantSprint;
    this.isMoving = moving;

    const speed = this.isCrouching
      ? p.crouchSpeed
      : wantSprint
        ? p.sprintSpeed
        : p.walkSpeed;

    // --- Jump & gravity ---
    if (
      input.wasPressed("Space") &&
      this.grounded &&
      !this.isCrouching &&
      stats.trySpendStamina(CONFIG.stamina.jumpCost)
    ) {
      this.velocityY = p.jumpSpeed;
      this.grounded = false;
    }
    this.velocityY += p.gravity * dt;

    // --- Integrate ---
    this.position.addScaledVector(wish, speed * dt);
    this.position.y += this.velocityY * dt;

    // Horizontal collision (props + world bounds), then settle onto terrain.
    world.resolveHorizontal(this.position, p.radius);
    const groundY = world.groundHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocityY = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // --- Smooth crouch + camera placement ---
    const targetEye = this.isCrouching ? p.crouchEyeHeight : p.standEyeHeight;
    this.eyeHeight = lerp(this.eyeHeight, targetEye, Math.min(1, dt * 10));
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z,
    );

    this.updateViewmodel(dt, moving && this.grounded, speed);
  }

  setEquippedTool(itemId: string | null): void {
    if (this.toolMesh) {
      this.camera.remove(this.toolMesh);
      this.toolMesh = null;
    }
    if (itemId === "stone_blade") this.toolMesh = makeStoneBladeViewmodel();
    else if (itemId === "spike_lance") this.toolMesh = makeSpikeLanceViewmodel();
    else if (itemId === "scanner") this.toolMesh = makeScannerViewmodel();
    if (this.toolMesh) this.camera.add(this.toolMesh);
  }

  hasToolEquipped(): boolean {
    return this.toolMesh !== null;
  }

  /** Camera forward direction (unit), for combat aiming. */
  forward(): THREE.Vector3 {
    return this.camera.getWorldDirection(new THREE.Vector3());
  }

  /** Begin a melee swing animation on the held tool. */
  triggerSwing(): void {
    this.swingTimer = 0.28;
  }

  get isGrappling(): boolean {
    return this.grappling;
  }

  /** Zip the player toward a world point (grapple hook). */
  grappleTo(point: THREE.Vector3): void {
    this.grappleTarget.copy(point);
    this.grappling = true;
    this.grappleTimer = CONFIG.grapple.timeoutSec;
  }

  private updateGrapple(dt: number, world: World): void {
    this.grappleTimer -= dt;
    const dir = new THREE.Vector3().copy(this.grappleTarget).sub(this.position);
    const dist = dir.length();
    if (dist <= CONFIG.grapple.arriveDist || this.grappleTimer <= 0) {
      this.grappling = false;
      this.velocityY = 0;
      this.grounded = false;
      return;
    }
    dir.normalize();
    this.position.addScaledVector(dir, Math.min(CONFIG.grapple.pullSpeed * dt, dist));
    const gy = world.groundHeight(this.position.x, this.position.z);
    if (this.position.y < gy) this.position.y = gy;
    this.isSprinting = false;
    this.isMoving = true;
  }

  private updateViewmodel(dt: number, walking: boolean, speed: number): void {
    if (!this.toolMesh) return;
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const t = 1 - this.swingTimer / 0.28;
      const arc = Math.sin(t * Math.PI);
      this.toolMesh.rotation.set(0.1 - arc * 1.5, -0.3 + arc * 0.5, arc * 0.6);
      this.toolMesh.position.set(0.34 - arc * 0.16, -0.32 + arc * 0.12, -0.6 + arc * 0.14);
      return;
    }
    const bobbing = walking && this.bobEnabled;
    if (bobbing) this.bobPhase += dt * speed * 1.6;
    const bob = bobbing ? Math.sin(this.bobPhase) * 0.012 : 0;
    const sway = bobbing ? Math.cos(this.bobPhase * 0.5) * 0.008 : 0;
    this.toolMesh.rotation.set(0.1, -0.3, 0);
    this.toolMesh.position.set(0.34 + sway, -0.32 + bob, -0.6);
  }
}

function makeStoneBladeViewmodel(): THREE.Group {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.18, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 1 }),
  );
  handle.rotation.z = Math.PI / 2.3;
  group.add(handle);

  const blade = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.22, 4),
    new THREE.MeshStandardMaterial({
      color: 0x9a9aa6,
      roughness: 0.6,
      metalness: 0.2,
      flatShading: true,
    }),
  );
  blade.rotation.z = -Math.PI / 2.6;
  blade.position.set(0.13, 0.06, 0);
  group.add(blade);

  group.position.set(0.34, -0.32, -0.6);
  group.rotation.set(0.1, -0.3, 0);
  return group;
}

function makeSpikeLanceViewmodel(): THREE.Group {
  const group = new THREE.Group();
  const haft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a7178, roughness: 0.6, metalness: 0.5 }),
  );
  haft.rotation.z = Math.PI / 2.2;
  group.add(haft);
  const point = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.26, 4),
    new THREE.MeshStandardMaterial({
      color: 0x2a6f8a,
      emissive: 0x39c6e0,
      emissiveIntensity: 0.6,
      flatShading: true,
    }),
  );
  point.rotation.z = -Math.PI / 2.2;
  point.position.set(0.27, 0.1, 0);
  group.add(point);
  group.position.set(0.34, -0.32, -0.6);
  group.rotation.set(0.1, -0.3, 0);
  return group;
}

function makeScannerViewmodel(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.1, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x44484f, roughness: 0.5, metalness: 0.5 }),
  );
  group.add(body);
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.06, 0.01),
    new THREE.MeshStandardMaterial({
      color: 0x0c2e2a,
      emissive: 0x3fe6c8,
      emissiveIntensity: 1.0,
    }),
  );
  screen.position.set(0, 0.01, 0.035);
  group.add(screen);
  group.position.set(0.32, -0.3, -0.55);
  group.rotation.set(0.2, -0.2, 0);
  return group;
}
