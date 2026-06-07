import { CraftingStation, QualityEnum, type Recipe } from "../core/types";

/**
 * Recipes (GDD §5.2). Tier 0 is known from the start and crafted by HAND.
 * Tier 1 requires a built Fabricator and is "discovered" by experimentation —
 * a recipe reveals itself the first time the player holds all its ingredients
 * (GDD §5.1: "no recipe books").
 */
export const RECIPES: Recipe[] = [
  // --- Tier 0 (HAND, always known) ---
  {
    id: "r_stone_blade",
    name: "Stone Blade",
    tier: 0,
    outputItemId: "stone_blade",
    outputQuantity: 1,
    ingredients: [
      { itemId: "ash_sediment", quantity: 2 },
      { itemId: "fiber_frond", quantity: 1 },
    ],
    station: CraftingStation.Hand,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Crude,
  },
  {
    id: "r_fiber_wrap",
    name: "Fiber Wrap",
    tier: 0,
    outputItemId: "fiber_wrap",
    outputQuantity: 1,
    ingredients: [{ itemId: "fiber_frond", quantity: 3 }],
    station: CraftingStation.Hand,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Crude,
  },
  {
    id: "r_shelter_kit",
    name: "Shelter Kit",
    tier: 0,
    outputItemId: "shelter_kit",
    outputQuantity: 1,
    ingredients: [
      { itemId: "ash_sediment", quantity: 6 },
      { itemId: "fiber_frond", quantity: 4 },
    ],
    station: CraftingStation.Hand,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Crude,
  },

  // --- Tier 1 (FABRICATOR, discovered by experimentation) ---
  {
    id: "r_alloy_frame",
    name: "Alloy Frame",
    tier: 1,
    outputItemId: "alloy_frame",
    outputQuantity: 1,
    ingredients: [
      { itemId: "ship_alloy_scrap", quantity: 2 },
      { itemId: "ash_sediment", quantity: 4 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },
  {
    id: "r_spike_lance",
    name: "Spike Lance",
    tier: 1,
    outputItemId: "spike_lance",
    outputQuantity: 1,
    ingredients: [
      { itemId: "alloy_frame", quantity: 1 },
      { itemId: "spine_crystal_shard", quantity: 2 },
      { itemId: "vaelun_hide", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Standard,
  },
  {
    id: "r_scanner",
    name: "Scanner",
    tier: 1,
    outputItemId: "scanner",
    outputQuantity: 1,
    ingredients: [
      { itemId: "alloy_frame", quantity: 1 },
      { itemId: "spine_crystal_shard", quantity: 2 },
      { itemId: "bioluminite", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Standard,
  },
  {
    id: "r_topographic_mapper",
    name: "Topographic Mapper",
    tier: 1,
    outputItemId: "topographic_mapper",
    outputQuantity: 1,
    ingredients: [
      { itemId: "alloy_frame", quantity: 1 },
      { itemId: "spine_crystal_shard", quantity: 2 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Standard,
  },
  {
    id: "r_purge_compound",
    name: "Purge Compound",
    tier: 1,
    outputItemId: "purge_compound",
    outputQuantity: 2,
    ingredients: [
      { itemId: "veil_resin", quantity: 2 },
      { itemId: "bioluminite", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },
  {
    id: "r_aug_iron_gut",
    name: "Iron Gut Augment",
    tier: 1,
    outputItemId: "aug_iron_gut",
    outputQuantity: 1,
    ingredients: [
      { itemId: "vaelun_hide", quantity: 2 },
      { itemId: "spore_cap", quantity: 2 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },

  // --- Tier 2 (FABRICATOR, requires a recovered Ship Component) ---
  {
    id: "r_energy_cell",
    name: "Energy Cell",
    tier: 2,
    outputItemId: "energy_cell",
    outputQuantity: 1,
    ingredients: [
      { itemId: "ship_alloy_scrap", quantity: 1 },
      { itemId: "bioluminite", quantity: 2 },
      { itemId: "veil_resin", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },
  {
    id: "r_aug_veil_sense",
    name: "Veil-Sense Augment",
    tier: 2,
    outputItemId: "aug_veil_sense",
    outputQuantity: 1,
    ingredients: [
      { itemId: "energy_cell", quantity: 1 },
      { itemId: "spine_crystal_shard", quantity: 2 },
      { itemId: "bioluminite", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },
  {
    id: "r_aug_carrier_frame",
    name: "Carrier Frame Augment",
    tier: 2,
    outputItemId: "aug_carrier_frame",
    outputQuantity: 1,
    ingredients: [
      { itemId: "alloy_frame", quantity: 2 },
      { itemId: "vaelun_hide", quantity: 2 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },
  {
    id: "r_aug_deep_lung",
    name: "Deep Lung Augment",
    tier: 2,
    outputItemId: "aug_deep_lung",
    outputQuantity: 1,
    ingredients: [
      { itemId: "energy_cell", quantity: 1 },
      { itemId: "vaelun_hide", quantity: 2 },
      { itemId: "veil_resin", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },

  {
    id: "r_signal_tracer",
    name: "Signal Tracer",
    tier: 2,
    outputItemId: "signal_tracer",
    outputQuantity: 1,
    ingredients: [
      { itemId: "energy_cell", quantity: 1 },
      { itemId: "spine_crystal_shard", quantity: 2 },
      { itemId: "ship_component", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },
  {
    id: "r_grapple_hook",
    name: "Grapple Hook",
    tier: 2,
    outputItemId: "grapple_hook",
    outputQuantity: 1,
    ingredients: [
      { itemId: "alloy_frame", quantity: 1 },
      { itemId: "spine_crystal_shard", quantity: 2 },
      { itemId: "energy_cell", quantity: 1 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.Refined,
  },

  // --- Tier 3 (requires reaching the Cradle; Phase 10) ---
  {
    id: "r_aug_veil_null",
    name: "Veil-null Augment",
    tier: 3,
    outputItemId: "aug_veil_null",
    outputQuantity: 1,
    ingredients: [
      { itemId: "energy_cell", quantity: 2 },
      { itemId: "veil_resin", quantity: 3 },
      { itemId: "bioluminite", quantity: 2 },
    ],
    station: CraftingStation.Fabricator,
    craftTimeSec: 0,
    qualityOutput: QualityEnum.VeilForged,
  },
];
