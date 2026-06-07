import { smoothstep } from "./math";

/** GDD §2 biomes. Phases 5-9 add Spinewoods (B02), Veil Sink (B03), Warrens (B04), Cradle (B05). */
export enum Biome {
  Ashfields = "ASHFIELDS",
  Spinewoods = "SPINEWOODS",
  VeilSink = "VEIL_SINK",
  Warrens = "WARRENS",
  Cradle = "CRADLE",
}

export const BIOME_LABEL: Record<Biome, string> = {
  [Biome.Ashfields]: "The Ashfields",
  [Biome.Spinewoods]: "The Spinewoods",
  [Biome.VeilSink]: "The Veil Sink",
  [Biome.Warrens]: "The Crust Warrens",
  [Biome.Cradle]: "The Cradle",
};

/** Circular biome regions with a ~100m gradient blend (GDD §2). */
export const SPINEWOODS = { cx: 230, cz: 210, inner: 120, outer: 220 } as const;
export const VEIL_SINK = { cx: -250, cz: -230, inner: 110, outer: 210 } as const;
export const WARRENS = { cx: 250, cz: -250, inner: 70, outer: 130 } as const;
export const CRADLE = { cx: -280, cz: 260, inner: 90, outer: 170 } as const;

/** 1 = deep Spinewoods, 0 = outside, blended in the overlap band. */
export function spinewoodsFactor(x: number, z: number): number {
  const d = Math.hypot(x - SPINEWOODS.cx, z - SPINEWOODS.cz);
  return 1 - smoothstep(SPINEWOODS.inner, SPINEWOODS.outer, d);
}

/** 1 = deep Veil Sink, 0 = outside. */
export function veilSinkFactor(x: number, z: number): number {
  const d = Math.hypot(x - VEIL_SINK.cx, z - VEIL_SINK.cz);
  return 1 - smoothstep(VEIL_SINK.inner, VEIL_SINK.outer, d);
}

/** 1 = deep Crust Warrens, 0 = outside. */
export function warrensFactor(x: number, z: number): number {
  const d = Math.hypot(x - WARRENS.cx, z - WARRENS.cz);
  return 1 - smoothstep(WARRENS.inner, WARRENS.outer, d);
}

/** 1 = deep Cradle, 0 = outside. */
export function cradleFactor(x: number, z: number): number {
  const d = Math.hypot(x - CRADLE.cx, z - CRADLE.cz);
  return 1 - smoothstep(CRADLE.inner, CRADLE.outer, d);
}

export function biomeAt(x: number, z: number): Biome {
  const warren = warrensFactor(x, z);
  const veil = veilSinkFactor(x, z);
  const spine = spinewoodsFactor(x, z);
  const cradle = cradleFactor(x, z);
  if (cradle >= 0.5 && cradle >= warren && cradle >= veil && cradle >= spine) return Biome.Cradle;
  if (warren >= 0.5 && warren >= veil && warren >= spine) return Biome.Warrens;
  if (veil >= 0.5 && veil >= spine) return Biome.VeilSink;
  if (spine >= 0.5) return Biome.Spinewoods;
  return Biome.Ashfields;
}
