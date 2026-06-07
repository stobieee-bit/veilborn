import * as THREE from "three";
import { CONFIG } from "../config";
import { clamp01, smoothstep } from "../core/math";
import { WeatherType } from "../core/types";
import type { World } from "../world/World";

interface WeatherParams {
  fall: number; // m/s downward
  wind: THREE.Vector2; // horizontal drift
  size: number;
  color: number;
  opacity: number;
  fogAdd: number; // extra fog density at full intensity
  fogColor: number;
}

const PARAMS: Record<WeatherType, WeatherParams | null> = {
  [WeatherType.Clear]: null,
  [WeatherType.Ashstorm]: {
    fall: 3.0,
    wind: new THREE.Vector2(9, 4),
    size: 0.5,
    color: 0xb8ada0,
    opacity: 0.8,
    fogAdd: 0.02,
    fogColor: 0x6b6358,
  },
  [WeatherType.VeilRain]: {
    fall: 17,
    wind: new THREE.Vector2(2, 1),
    size: 0.22,
    color: 0x6fe0d0,
    opacity: 0.7,
    fogAdd: 0.008,
    fogColor: 0x24343a,
  },
};

const BOX = 34;
const TOP = 36;
const BOTTOM = -6;
const COUNT = 1100;

/**
 * GDD §2 weather: a Clear ↔ event cycle (Ashstorm / Veil-rain) with drifting
 * particles and reduced visibility. Exposes the current type + ramp intensity;
 * the Game reads these to drive Warmth and Veil Exposure.
 */
export class Weather {
  current: WeatherType = WeatherType.Clear;
  intensity = 0; // 0..1 ramp

  private timer: number;
  private phaseDuration: number;
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;

  constructor(private readonly world: World) {
    this.phaseDuration = rand(CONFIG.weather.minClearSec, CONFIG.weather.maxClearSec);
    this.timer = this.phaseDuration;

    this.positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      this.positions[i * 3] = (Math.random() * 2 - 1) * BOX;
      this.positions[i * 3 + 1] = Math.random() * (TOP - BOTTOM) + BOTTOM;
      this.positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOX;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    world.scene.add(this.points);
  }

  get label(): string {
    return this.current === WeatherType.Ashstorm
      ? "Ashstorm"
      : this.current === WeatherType.VeilRain
        ? "Veil-rain"
        : "Clear";
  }

  /** Force a specific weather (used by save/load or debugging). */
  set(type: WeatherType): void {
    this.current = type;
    this.intensity = type === WeatherType.Clear ? 0 : 1;
    const range =
      type === WeatherType.Clear
        ? [CONFIG.weather.minClearSec, CONFIG.weather.maxClearSec]
        : [CONFIG.weather.minEventSec, CONFIG.weather.maxEventSec];
    this.phaseDuration = rand(range[0], range[1]);
    this.timer = this.phaseDuration;
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.timer -= dt;
    if (this.timer <= 0) this.advancePhase();

    // Ramp intensity in/out over the first/last few seconds of an event.
    if (this.current === WeatherType.Clear) {
      this.intensity = 0;
    } else {
      const elapsed = this.phaseDuration - this.timer;
      const rampIn = smoothstep(0, 4, elapsed);
      const rampOut = smoothstep(0, 4, this.timer);
      this.intensity = clamp01(Math.min(rampIn, rampOut));
    }

    this.updateParticles(dt, cameraPos);
    this.applyVisibility();
  }

  private advancePhase(): void {
    if (this.current === WeatherType.Clear) {
      const type =
        Math.random() < CONFIG.weather.ashstormChance
          ? WeatherType.Ashstorm
          : WeatherType.VeilRain;
      this.current = type;
      this.phaseDuration = rand(CONFIG.weather.minEventSec, CONFIG.weather.maxEventSec);
    } else {
      this.current = WeatherType.Clear;
      this.phaseDuration = rand(CONFIG.weather.minClearSec, CONFIG.weather.maxClearSec);
    }
    this.timer = this.phaseDuration;
  }

  private updateParticles(dt: number, cameraPos: THREE.Vector3): void {
    const p = PARAMS[this.current];
    const mat = this.points.material as THREE.PointsMaterial;
    if (!p || this.intensity <= 0.01) {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    this.points.position.copy(cameraPos);
    mat.size = p.size;
    mat.color.setHex(p.color);
    mat.opacity = p.opacity * this.intensity;

    const dx = p.wind.x * dt;
    const dz = p.wind.y * dt;
    const dy = p.fall * dt;
    const pos = this.positions;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      pos[j] += dx;
      pos[j + 1] -= dy;
      pos[j + 2] += dz;
      if (pos[j + 1] < BOTTOM) pos[j + 1] = TOP;
      if (pos[j] > BOX) pos[j] -= BOX * 2;
      else if (pos[j] < -BOX) pos[j] += BOX * 2;
      if (pos[j + 2] > BOX) pos[j + 2] -= BOX * 2;
      else if (pos[j + 2] < -BOX) pos[j + 2] += BOX * 2;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  private applyVisibility(): void {
    const p = PARAMS[this.current];
    if (!p || this.intensity <= 0) return;
    this.world.fog.density += p.fogAdd * this.intensity;
    this.world.fog.color.lerp(new THREE.Color(p.fogColor), this.intensity * 0.6);
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
