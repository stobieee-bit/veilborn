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

  // Reused per-frame scratch (sun direction + sun-color anchors).
  private readonly sunDir = new THREE.Vector3();
  private readonly sunWarm = new THREE.Color(0xff8a3c);
  private readonly sunHot = new THREE.Color(0xffe6b8);

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

  /** 0 at deep night → 1 at full day (drives solar-panel output). */
  get daylight(): number {
    return clamp01(this.sunElevation * 1.4 + 0.18);
  }

  get clockString(): string {
    const h = Math.floor(this.timeOfDay) % 24;
    const m = Math.floor((this.timeOfDay - Math.floor(this.timeOfDay)) * 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  private get sunElevation(): number {
    // GDD §2 — 28 min day : 22 min night. Sunrise at 6:00; the sun's half-sine
    // is stretched over the day fraction and the night dip over the remainder,
    // so the pieces join continuously at the horizon.
    const dayLen = 24 * CONFIG.time.dayFraction;
    const t = (this.timeOfDay - 6 + 24) % 24; // hours since sunrise
    if (t < dayLen) return Math.sin((t / dayLen) * Math.PI);
    return -Math.sin(((t - dayLen) / (24 - dayLen)) * Math.PI);
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.timeOfDay =
      (this.timeOfDay + dt * (24 / CONFIG.time.secondsPerFullDay)) % 24;

    const elev = this.sunElevation;
    const daylight = clamp01(elev * 1.4 + 0.18);
    const twilight = clamp01(1 - Math.abs(elev) * 4); // peaks at sunrise/sunset

    // --- Sun direction & light ---
    const arc = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const dir = this.sunDir
      .set(Math.cos(arc), Math.max(elev, -0.2), Math.sin(arc) * 0.6)
      .normalize();
    this.world.sun.position.copy(cameraPos).addScaledVector(dir, 120);
    this.world.sun.target.position.copy(cameraPos);
    this.world.sun.intensity = clamp01(elev * 1.6) * 1.7;
    this.cSun.copy(this.sunWarm).lerp(this.sunHot, clamp01(elev * 3));
    this.world.sun.color.copy(this.cSun);

    // --- Ambient / hemisphere (keep a Veil-lit floor at night) ---
    // Night keeps a navigable floor (raised in the visual pass) while staying
    // dark enough that the Veil-matter glow reads as the dominant light (GDD §2).
    this.world.hemi.intensity = lerp(0.24, 0.7, daylight);
    this.world.ambient.intensity = lerp(0.26, 0.3, daylight);

    // --- Sky gradient ---
    this.cTop.copy(this.nightTop).lerp(this.dayTop, daylight);
    this.cBottom.copy(this.nightBottom).lerp(this.dayBottom, daylight);
    this.cTop.lerp(this.twilightTop, twilight * 0.6);
    this.cBottom.lerp(this.twilightBottom, twilight * 0.7);
    this.world.sky.setColors(this.cTop, this.cBottom);
    this.cHemiSky.copy(this.cBottom);
    this.world.hemi.color.copy(this.cHemiSky);
    this.world.sky.mesh.position.copy(cameraPos);
    this.world.starfield.position.copy(cameraPos);
    // Hazy sun disc rides the sun direction (god-ray source); fades out at night.
    this.world.sunSprite.position.copy(cameraPos).addScaledVector(this.sunDir, CONFIG.world.size * 0.85);
    (this.world.sunSprite.material as THREE.SpriteMaterial).opacity = clamp01(daylight * 1.2);

    // --- Fog tracks the horizon color and thickens at night ---
    this.cFog.copy(this.cBottom);
    this.world.fog.color.copy(this.cFog);
    this.world.fog.density = lerp(
      CONFIG.world.fogDensityDay,
      CONFIG.world.fogDensityNight,
      1 - daylight,
    );

    // --- Veil-matter glow + flow animation + night motes ---
    this.world.setVeilGlow(clamp01(1 - daylight * 1.35));
    this.world.advanceVeilTime(dt);
    this.world.updateMotes(dt, cameraPos);
  }
}
