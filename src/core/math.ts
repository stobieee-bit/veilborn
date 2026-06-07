/** Small math helpers shared across systems. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep easing on [0,1]. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic hash -> [0,1). Used for stable, save-friendly procedural
 * scatter of greybox props so the world looks the same every run without
 * Math.random().
 */
export function hash2(x: number, y: number): number {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  h = h - Math.floor(h);
  return h;
}

/**
 * Terrain height field for the Ashfields greybox. A sum of low-frequency sines
 * produces gentle rolling dunes. The ground mesh and the player's ground
 * collision both sample this so they always agree.
 */
export function terrainHeight(x: number, z: number): number {
  const h =
    Math.sin(x * 0.0125) * Math.cos(z * 0.0102) * 6.0 +
    Math.sin(x * 0.041 + 1.3) * 2.2 +
    Math.cos(z * 0.037 - 0.7) * 2.0 +
    Math.sin((x + z) * 0.069) * 0.8;
  // Veil Sink depression — a basin (mirrors VEIL_SINK in core/biomes.ts).
  const dvs = Math.hypot(x + 250, z + 230);
  const sink = (1 - smoothstep(110, 210, dvs)) * 7.5;
  // Crust Warrens — a deep pit you descend into (mirrors WARRENS in core/biomes.ts).
  const dwa = Math.hypot(x - 250, z + 250);
  const warren = (1 - smoothstep(70, 130, dwa)) * 26;
  return h - sink - warren;
}
