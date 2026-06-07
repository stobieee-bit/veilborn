import * as THREE from "three";
import { CONFIG } from "../config";
import { clamp01, lerp } from "../core/math";
import type { World } from "./World";

/**
 * Drives the 24h cycle: sun arc, light intensities, sky gradient, fog and
 * Veil-matter glow. GDD §2 — perpetually overcast amber-orange days, dark
 * nights where Veil-matter is the dominant light.
 */
export class DayNightCycle {
  timeOfDay: number; // hours [0, 24)

  // Reused color scratch to avoid per-frame allocations.
  private readonly cTop = new THREE.Color();
  private readonly cBottom = new THREE.Color();
  private readonly cFog = new THREE.Color();
  private readonly cSun = new THREE.Color();
  private readonly cHemiSky = new THREE.Color();

  // Palette anchors.
  private readonly dayTop = new THREE.Color(0x8a5e36);
  private readonly dayBottom = new THREE.Color(0xcf9a63);
  private readonly nightTop = new THREE.Color(0x05070f);
  private readonly nightBottom = new THREE.Color(0x111a2e);
  private readonly twilightTop = new THREE.Color(0x5a2d1e);
  private readonly twilightBottom = new THREE.Color(0xc2562a);

  constructor(private readonly world: World) {
    this.timeOfDay = CONFIG.time.startHour;
  }

  get isNight(): boolean {
    return this.sunElevation < 0;
  }

  get clockString(): string {
    const h = Math.floor(this.timeOfDay) % 24;
    const m = Math.floor((this.timeOfDay - Math.floor(this.timeOfDay)) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  private get sunElevation(): number {
    return Math.sin(((this.timeOfDay - 6) / 24) * Math.PI * 2);
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.timeOfDay =
      (this.timeOfDay + dt * (24 / CONFIG.time.secondsPerFullDay)) % 24;

    const elev = this.sunElevation;
    const daylight = clamp01(elev * 1.4 + 0.18);
    const twilight = clamp01(1 - Math.abs(elev) * 4); // peaks at sunrise/sunset

    // --- Sun direction & light ---
    const arc = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const dir = new THREE.Vector3(
      Math.cos(arc),
      Math.max(elev, -0.2),
      Math.sin(arc) * 0.6,
    ).normalize();
    this.world.sun.position.copy(cameraPos).addScaledVector(dir, 120);
    this.world.sun.target.position.copy(cameraPos);
    this.world.sun.intensity = clamp01(elev * 1.6) * 1.7;
    this.cSun
      .copy(new THREE.Color(0xff8a3c))
      .lerp(new THREE.Color(0xffe6b8), clamp01(elev * 3));
    this.world.sun.color.copy(this.cSun);

    // --- Ambient / hemisphere (keep a Veil-lit floor at night) ---
    this.world.hemi.intensity = lerp(0.14, 0.7, daylight);
    this.world.ambient.intensity = lerp(0.16, 0.3, daylight);

    // --- Sky gradient ---
    this.cTop.copy(this.nightTop).lerp(this.dayTop, daylight);
    this.cBottom.copy(this.nightBottom).lerp(this.dayBottom, daylight);
    this.cTop.lerp(this.twilightTop, twilight * 0.6);
    this.cBottom.lerp(this.twilightBottom, twilight * 0.7);
    this.world.sky.setColors(this.cTop, this.cBottom);
    this.cHemiSky.copy(this.cBottom);
    this.world.hemi.color.copy(this.cHemiSky);
    this.world.sky.mesh.position.copy(cameraPos);

    // --- Fog tracks the horizon color and thickens at night ---
    this.cFog.copy(this.cBottom);
    this.world.fog.color.copy(this.cFog);
    this.world.fog.density = lerp(
      CONFIG.world.fogDensityDay,
      CONFIG.world.fogDensityNight,
      1 - daylight,
    );

    // --- Veil-matter glow ---
    this.world.setVeilGlow(clamp01(1 - daylight * 1.35));
  }
}
