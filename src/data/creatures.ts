import { DetectionType, type CreatureDef } from "../core/types";

/**
 * Creature roster (GDD §9.2). Phase 3 ships the Ashfields Scout (C01);
 * later phases add the Spineback, Drifter, Crawler, etc.
 */
export const SCOUT: CreatureDef = {
  id: "C01",
  name: "Scout",
  maxHealth: 42,
  patrolSpeed: 2.2,
  chaseSpeed: 5.0,
  fleeSpeed: 6.0,
  attackDamage: 8,
  attackCooldown: 1.3,
  attackRange: 2.1,
  detectionRange: 22,
  detectionType: DetectionType.Sight,
  fleeHealthFrac: 0.28,
  loot: [
    { itemId: "vaelun_hide", min: 1, max: 2, chance: 1.0 },
    { itemId: "spore_cap", min: 0, max: 1, chance: 0.4 },
  ],
  isApex: false,
};

/** C02 — Spinewoods ambush predator. Lurks near the crystalline trees, then
 * bursts when the player comes close or lingers too long (GDD §9.2). */
export const SPINEBACK: CreatureDef = {
  id: "C02",
  name: "Spineback",
  maxHealth: 64,
  patrolSpeed: 0.6, // barely moves while lurking
  chaseSpeed: 7.6, // fast ambush burst
  fleeSpeed: 7.0,
  attackDamage: 14,
  attackCooldown: 1.4,
  attackRange: 2.2,
  detectionRange: 26,
  detectionType: DetectionType.Sight,
  fleeHealthFrac: 0.22,
  loot: [
    { itemId: "vaelun_hide", min: 1, max: 2, chance: 1.0 },
    { itemId: "spine_crystal_shard", min: 0, max: 1, chance: 0.5 },
  ],
  isApex: false,
  ambush: true,
  ambushRange: 9,
};

/** C04 — Warrens swarm. Weak alone but hunts in numbers around its nests;
 * fast and relentless (GDD §9.2). */
export const CRAWLER: CreatureDef = {
  id: "C04",
  name: "Crawler",
  maxHealth: 38,
  patrolSpeed: 2.0,
  chaseSpeed: 5.8,
  fleeSpeed: 5.0,
  attackDamage: 10,
  attackCooldown: 1.0,
  attackRange: 1.8,
  detectionRange: 18,
  detectionType: DetectionType.Sight,
  fleeHealthFrac: 0, // swarm never flees
  loot: [
    { itemId: "vaelun_hide", min: 0, max: 1, chance: 0.6 },
    { itemId: "condensate_crystal", min: 0, max: 1, chance: 0.3 },
  ],
  isApex: false,
};

/** C03 — Veil Sink drifter. Drawn toward the player as Veil Exposure rises;
 * floats over the fog (GDD §9.2). */
export const DRIFTER: CreatureDef = {
  id: "C03",
  name: "Drifter",
  maxHealth: 56,
  patrolSpeed: 1.3,
  chaseSpeed: 3.6,
  fleeSpeed: 4.0,
  attackDamage: 12,
  attackCooldown: 1.5,
  attackRange: 2.4,
  detectionRange: 20,
  detectionType: DetectionType.Veil,
  fleeHealthFrac: 0.2,
  loot: [
    { itemId: "veil_resin", min: 1, max: 2, chance: 1.0 },
    { itemId: "bioluminite", min: 0, max: 1, chance: 0.5 },
  ],
  isApex: false,
  veilDrawThreshold: 40, // GDD: aggro at Exposure > 40
  floatHeight: 1.6,
};

/** C06 — night-only Veil Sink stalker that phases in and out of visibility;
 * very high threat, drawn at high exposure (GDD §9.2). */
export const VEIL_WRAITH: CreatureDef = {
  id: "C06",
  name: "Veil Wraith",
  maxHealth: 95,
  patrolSpeed: 1.0,
  chaseSpeed: 5.6,
  fleeSpeed: 0,
  attackDamage: 26,
  attackCooldown: 1.6,
  attackRange: 2.6,
  detectionRange: 28,
  detectionType: DetectionType.Veil,
  fleeHealthFrac: 0,
  loot: [
    { itemId: "veil_resin", min: 2, max: 3, chance: 1.0 },
    { itemId: "bioluminite", min: 1, max: 2, chance: 0.8 },
  ],
  isApex: false,
  veilDrawThreshold: 70, // GDD: aggro at Exposure > 70
  nightOnly: true,
  phasing: true,
  floatHeight: 0.2,
};

/** C07 — Cradle apex (Phase 9 placeholder; adaptation arrives in Phase 10).
 * Large, fast and very dangerous; does not flee (GDD §9.2/§9.4). */
export const CRADLE_SPAWN: CreatureDef = {
  id: "C07",
  name: "Cradle-Spawn",
  maxHealth: 220,
  patrolSpeed: 1.6,
  chaseSpeed: 6.2,
  fleeSpeed: 0,
  attackDamage: 30,
  attackCooldown: 1.5,
  attackRange: 2.8,
  detectionRange: 34,
  detectionType: DetectionType.Combined,
  fleeHealthFrac: 0,
  loot: [
    { itemId: "ship_alloy_scrap", min: 2, max: 4, chance: 1.0 },
    { itemId: "veil_resin", min: 1, max: 2, chance: 0.8 },
  ],
  isApex: true,
};

/** C05 — territorial caller. On first sight it bellows, rousing nearby fauna
 * to the player; high threat, does not flee (GDD §9.2). */
export const BELLOWER: CreatureDef = {
  id: "C05",
  name: "Bellower",
  maxHealth: 130,
  patrolSpeed: 1.5,
  chaseSpeed: 4.2,
  fleeSpeed: 3.0,
  attackDamage: 18,
  attackCooldown: 1.9,
  attackRange: 2.7,
  detectionRange: 30,
  detectionType: DetectionType.Sight,
  fleeHealthFrac: 0, // territorial: fights to the death
  loot: [
    { itemId: "vaelun_hide", min: 2, max: 3, chance: 1.0 },
    { itemId: "veil_resin", min: 0, max: 1, chance: 0.5 },
  ],
  isApex: false,
  caller: true,
  callRadius: 60,
};
