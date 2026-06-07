/** A colony-ship crash site POI (GDD §11.1, §17 Phase 6). */
export interface CrashSite {
  id: string;
  name: string;
  x: number;
  z: number;
  loot: { itemId: string; qty: number }[];
  augmentItemId: string; // colony-ship-loot augment recovered here
}

/**
 * Three CALDERA crash sites scattered across the map. Each yields salvage, a
 * Ship Component (unlocks Tier-2 fabrication) and a colony-ship-loot augment.
 */
export const CRASH_SITES: CrashSite[] = [
  {
    id: "CR1",
    name: "CALDERA Debris — Port Nacelle",
    x: -210,
    z: 150,
    loot: [
      { itemId: "ship_alloy_scrap", qty: 4 },
      { itemId: "ship_component", qty: 1 },
    ],
    augmentItemId: "aug_reflex_filter", // A06
  },
  {
    id: "CR2",
    name: "CALDERA Debris — Crew Module",
    x: 140,
    z: -235,
    loot: [
      { itemId: "ship_alloy_scrap", qty: 5 },
      { itemId: "ship_component", qty: 1 },
    ],
    augmentItemId: "aug_bone_lace", // A08
  },
  {
    id: "CR3",
    name: "CALDERA Debris — Dorsal Spine",
    x: 340,
    z: 40,
    loot: [
      { itemId: "ship_alloy_scrap", qty: 4 },
      { itemId: "ship_component", qty: 1 },
    ],
    augmentItemId: "aug_thermal_skin", // A03 (Warrens in GDD; placed here for Phase 6)
  },
];
