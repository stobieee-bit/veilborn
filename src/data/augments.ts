import type { AugmentDef } from "../core/types";

/**
 * GDD §8.2 — 8 passive augments, installed at a Medical Station (max 5 slots).
 * The `id` drives the effect in {@link AugmentSystem}.
 */
export const AUGMENTS: AugmentDef[] = [
  { id: "A01", name: "Iron Gut", description: "Raw food never causes Gut-rot.", itemId: "aug_iron_gut", slotCost: 1 },
  { id: "A02", name: "Veil-Sense", description: "Displays Veil Exposure in realtime on the HUD.", itemId: "aug_veil_sense", slotCost: 1 },
  { id: "A03", name: "Thermal Skin", description: "Warmth drain reduced 40%.", itemId: "aug_thermal_skin", slotCost: 1 },
  { id: "A04", name: "Carrier Frame", description: "+10 kg carry capacity.", itemId: "aug_carrier_frame", slotCost: 1 },
  { id: "A05", name: "Deep Lung", description: "Oxygen reserve +50% (Warrens traversal).", itemId: "aug_deep_lung", slotCost: 1 },
  { id: "A06", name: "Reflex Filter", description: "Stamina regen 25% faster.", itemId: "aug_reflex_filter", slotCost: 1 },
  { id: "A07", name: "Veil-null", description: "Veil Exposure rises 30% slower.", itemId: "aug_veil_null", slotCost: 2 },
  { id: "A08", name: "Bone Lace", description: "Incoming physical damage reduced 15%.", itemId: "aug_bone_lace", slotCost: 2 },
];

export const AUGMENT_BY_ITEM: Record<string, AugmentDef> = Object.fromEntries(
  AUGMENTS.map((a) => [a.itemId, a]),
);
export const AUGMENT_BY_ID: Record<string, AugmentDef> = Object.fromEntries(
  AUGMENTS.map((a) => [a.id, a]),
);

export const MAX_AUGMENT_SLOTS = 5; // GDD §8.2
