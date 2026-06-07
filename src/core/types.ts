/**
 * Core type definitions for VEILBORN, derived from the GDD data structures.
 * Scope is Phase 1 — survival stats, inventory, materials, items and Tier-0
 * crafting. Enemy/base/augment types arrive in their respective phases.
 */

export enum StatEnum {
  Health = "health",
  Stamina = "stamina",
  Hunger = "hunger",
  Hydration = "hydration",
  Warmth = "warmth",
  VeilExposure = "veil_exposure",
}

/** GDD §5.1 quality tiers. */
export enum QualityEnum {
  Crude = "CRUDE",
  Standard = "STANDARD",
  Refined = "REFINED",
  VeilForged = "VEIL_FORGED",
}

/** GDD §5.3 material categories. */
export enum MaterialCategory {
  Organic = "ORGANIC",
  Mineral = "MINERAL",
  Synthetic = "SYNTHETIC",
  VeilCompound = "VEIL_COMPOUND",
}

/** What an item fundamentally is, for inventory/hotbar handling. */
export enum ItemCategory {
  Material = "MATERIAL",
  Tool = "TOOL",
  Consumable = "CONSUMABLE",
  Placeable = "PLACEABLE",
  Augment = "AUGMENT", // installed at a Medical Station, not used from the hotbar
}

/** GDD §5.4 crafting stations. Phase 1 only uses HAND. */
export enum CraftingStation {
  Hand = "HAND",
  SurvivalKit = "SURVIVAL_KIT",
  Fabricator = "FABRICATOR",
  AdvFabricator = "ADV_FABRICATOR",
}

/** How a usable item affects the player when consumed/activated. */
export type UseAction =
  | { kind: "eat"; hunger: number }
  | { kind: "drink"; hydration: number }
  | { kind: "heal"; health: number }
  | { kind: "purge"; veil: number } // reduces Veil Exposure
  | { kind: "equip" } // tools: become the active held tool
  | { kind: "place"; prop: "shelter" }; // placeables: spawn a world prop

/**
 * Unified item definition. In the GDD, raw materials and craftables are
 * separate concepts; the prototype unifies them so everything an inventory can
 * hold shares one shape. Materials simply carry a `materialCategory`.
 */
export interface ItemDef {
  id: string;
  name: string;
  description: string;
  weight: number; // kg per unit
  stackSize: number;
  category: ItemCategory;
  materialCategory?: MaterialCategory; // present when category === Material
  quality: QualityEnum;
  use?: UseAction; // present when the item is usable from the hotbar
  maxDurability?: number; // present for tools (GDD §10.3)
  toolDamage?: number; // melee damage for weapon tools
}

/** A recipe ingredient (GDD §5.4). References an item id in the prototype. */
export interface Ingredient {
  itemId: string;
  quantity: number;
}

/** GDD §5.4 recipe. */
export interface Recipe {
  id: string;
  name: string;
  tier: number; // 0 = always known; 1+ = discovered (GDD §5.2)
  outputItemId: string;
  outputQuantity: number;
  ingredients: Ingredient[];
  station: CraftingStation;
  craftTimeSec: number;
  qualityOutput: QualityEnum;
}

/** A stack of one item kind held in an inventory. */
export interface ItemStack {
  itemId: string;
  quantity: number;
  durability?: number; // current durability for tool stacks
}

/** What a gatherable world node yields when harvested. */
export interface NodeYield {
  itemId: string;
  min: number;
  max: number;
}

// --- Phase 2: base building -------------------------------------------------

/** GDD §6.2 module types implemented in Phase 2-6. */
export enum ModuleType {
  Foundation = "FOUNDATION",
  Wall = "WALL",
  Doorway = "DOORWAY",
  Roof = "ROOF",
  FirePit = "FIRE_PIT",
  SleepingPod = "SLEEPING_POD",
  StorageCrate = "STORAGE_CRATE",
  PowerNode = "POWER_NODE",
  Fabricator = "FABRICATOR",
  MedicalStation = "MEDICAL_STATION",
  Condenser = "CONDENSER",
  LightPost = "LIGHT_POST", // GDD §6.2 Defense — base lighting
  PerimeterSpike = "PERIMETER_SPIKE", // GDD §6.2 Defense — damages nearby fauna
}

/** How a module snaps to the build grid. */
export type ModuleSnap = "cell" | "edge" | "roof" | "prop";

/** Collision footprint a placed module contributes. */
export type ModuleCollision = "none" | "wall" | "door" | "cylinder";

/** What interacting (E) with a placed module does. */
export type ModuleInteract = "sleep" | "storage" | "fabricator" | "medical" | "condenser" | "cook";

/** GDD §8.2 augment. The `id` drives its effect in the AugmentSystem. */
export interface AugmentDef {
  id: string;
  name: string;
  description: string;
  itemId: string; // the inventory item consumed to install it
  slotCost: number; // GDD: default 1, some cost 2
}

/**
 * Implemented by the build system and consulted by the World so the player can
 * walk on foundations and be blocked by walls without the World knowing about
 * the building module (keeps the dependency one-directional).
 */
export interface BaseProvider {
  /** Highest walkable surface at (x,z), or -Infinity if none. */
  surfaceHeight(x: number, z: number): number;
  /** Push a horizontal position out of base wall/prop colliders, in place. */
  resolveWalls(pos: { x: number; z: number }, radius: number): void;
}

// --- Phase 3: weather, fauna, combat ----------------------------------------

/** GDD §2 weather events implemented in Phase 3 (Ion surge is later). */
export enum WeatherType {
  Clear = "CLEAR",
  Ashstorm = "ASHSTORM",
  VeilRain = "VEIL_RAIN",
}

/** GDD §9.3 creature behaviour states. */
export enum BehaviorState {
  Idle = "IDLE",
  Patrol = "PATROL",
  Alert = "ALERT",
  Chase = "CHASE",
  Attack = "ATTACK",
  Flee = "FLEE",
}

/** GDD §9.3 detection modality. */
export enum DetectionType {
  Sight = "SIGHT",
  Sound = "SOUND",
  Veil = "VEIL",
  Combined = "COMBINED",
}

/** A single loot drop entry (GDD §9.3 LootEntry). */
export interface LootEntry {
  itemId: string;
  min: number;
  max: number;
  chance: number; // 0..1
}

/** Static definition of a creature (GDD §9.3 Creature). */
export interface CreatureDef {
  id: string;
  name: string;
  maxHealth: number;
  patrolSpeed: number; // m/s
  chaseSpeed: number;
  fleeSpeed: number;
  attackDamage: number;
  attackCooldown: number; // seconds
  attackRange: number; // m
  detectionRange: number; // m
  detectionType: DetectionType;
  fleeHealthFrac: number; // flees below this fraction of max health
  loot: LootEntry[];
  isApex: boolean;
  /** GDD C02: lurks until the player comes close (or lingers), then bursts. */
  ambush?: boolean;
  ambushRange?: number; // proximity that springs an ambush
  /** GDD C05: on first sighting, calls/alerts other fauna nearby. */
  caller?: boolean;
  callRadius?: number; // how far a bellow rouses other creatures
  /** GDD C03/C06: drawn to the player when Veil Exposure exceeds this. */
  veilDrawThreshold?: number;
  /** GDD C06: spawns/active only at night. */
  nightOnly?: boolean;
  /** GDD C06: periodically phases out of visibility (untargetable while faded). */
  phasing?: boolean;
  /** Hover height above the ground (floating creatures like the Drifter). */
  floatHeight?: number;
}

// --- Phase 5: lore fragments (GDD §12.2) ------------------------------------

export enum LoreType {
  AudioLog = "AUDIO_LOG",
  TextLog = "TEXT_LOG",
  Environmental = "ENVIRONMENTAL",
  CrewRecording = "CREW_RECORDING",
}

export interface LoreFragment {
  id: string;
  title: string;
  type: LoreType;
  crew: string | null;
  content: string;
  x: number;
  z: number;
  act: number;
  /** GDD §12: black-box fragments drive the Act-2 story beats + Signal Tracer. */
  blackBox?: boolean;
}
