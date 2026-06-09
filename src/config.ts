/**
 * VEILBORN — central tunables for the Phase 1 prototype.
 *
 * Values follow the GDD where the GDD specifies them. Where the GDD gives a
 * per-minute rate, it is converted to per-second in the systems that use it.
 * Anything marked "PROTOTYPE" is a placeholder choice to make Phase 1 playable
 * and is expected to be revisited in the Phase 12 balance pass.
 */
export const CONFIG = {
  player: {
    walkSpeed: 4.0, // m/s
    sprintSpeed: 7.0, // m/s
    crouchSpeed: 2.0, // m/s
    standEyeHeight: 1.7, // m
    crouchEyeHeight: 1.0, // m
    radius: 0.4, // m — horizontal collision capsule radius
    jumpSpeed: 7.0, // m/s — gives ~1.2 m apex under the gravity below
    gravity: -22.0, // m/s^2
    mouseSensitivity: 0.0022, // radians per pixel of pointer movement
    pitchClamp: 1.5, // radians (~86°) up/down look limit
    interactDistance: 3.2, // m — reach for gather/drink/use
  },

  stamina: {
    max: 100,
    sprintDrainPerSec: 12, // drained while sprinting
    jumpCost: 10, // GDD-adjacent; melee costs come in Phase 3
    regenPerSec: 9,
    regenDelaySec: 1.0, // pause before stamina regenerates after use
  },

  stats: {
    // GDD: hunger -1.5/min, hydration -2.5/min.
    hungerDecayPerMin: 1.5,
    hydrationDecayPerMin: 2.5,
    // GDD: health drain begins at hunger <15, hydration <10.
    hungerCritical: 15,
    hydrationCritical: 10,
    healthDrainPerSecPerStat: 0.6, // PROTOTYPE — per critical stat, per second
    healthRegenPerSec: 0.4, // PROTOTYPE — slow regen when well-fed & hydrated
    healthRegenHungerMin: 50, // need hunger above this to regen
    healthRegenHydrationMin: 50,
  },

  time: {
    // GDD canonical: 28 min day + 22 min night = 3000 s per full cycle.
    // For a demonstrable prototype the cycle is compressed; set to 3000 for
    // canonical pacing. Day runs roughly hour 6 -> 18, night 18 -> 6.
    secondsPerFullDay: 240, // PROTOTYPE — full 24h cycle in 4 real minutes
    startHour: 8.0, // begin mid-morning
  },

  world: {
    size: 1000, // m — Ashfields greybox is 1km x 1km
    terrainSegments: 200, // ground mesh resolution across the whole size
    fogDensityDay: 0.0042,
    fogDensityNight: 0.0072,
  },

  inventory: {
    maxWeight: 30, // kg — GDD default (upgradeable to 45 later)
    hotbarSlots: 6,
  },

  build: {
    cell: 2, // m — GDD §6.1 grid is 2m x 2m per tile
    floor: 3, // m — GDD §6.1 vertical floor height
    powerRadius: 5, // m — GDD §6.3 modules connect within 5m of a powered node
    reach: 7, // m — how far the build cursor projects from the camera
    storageWeight: 200, // kg — storage crate capacity
  },

  save: {
    key: "veilborn_save_v1",
  },

  // --- Phase 3: survival threats ---
  warmth: {
    max: 100,
    start: 100,
    nightDrainPerMin: 1.0, // GDD §4.4 Ashfields night
    ashstormDrainPerMin: 3.0, // GDD §4.4 Ashstorm override
    fireWarmPerMin: 2.0, // GDD §4.4 fire +2/min within 8m
    fireRadius: 8,
    coldThreshold: 25, // below: stamina drain + blurred vision
    freezingThreshold: 6, // below: slow health drain
    coldStaminaDrainPerSec: 1.6,
    freezingHealthPerSec: 0.4,
  },

  veil: {
    max: 100,
    start: 0,
    crystalRadius: 13, // exposure rises near crystal clusters
    crystalRisePerMin: 4.0,
    veilRainRisePerMin: 5.0, // GDD §4.3 veil-rain raises exposure
    nightRisePerMin: 0.6,
    decayPerMin: 2.0, // baseline decay
    shelterDecayPerMin: 6.0, // extra decay near fire / shelter
    distortStart: 28, // exposure at which visuals begin
    hallucinateStart: 55, // peripheral shapes + radio chatter begin
    episodePurgeTo: 60, // GDD §4.1: episode purges exposure to 60
    episodeDurationSec: 7,
    drifterDrawSpawn: 65, // very high exposure draws Drifters anywhere
    chatterMinSec: 9,
    chatterMaxSec: 20,
    restReduce: 30, // GDD §4.1 — resting at the pod lowers Veil Exposure
    rainDrinkHydration: 12, // GDD §4.3 — drinking unfiltered Veil-rain
    rainDrinkVeil: 5, // ...but it raises Veil Exposure +5
  },

  veilSink: {
    warmthDrainPerMin: 1.5, // GDD §4.4 cold + wet
    // Phase 12 balance: was 7.0 → net only +5/min after baseline decay, so a Veil
    // Episode took ~20 real min to reach and was never seen at the compressed
    // timescale. 12 gives ~+10/min net deep in the Sink — the signature threat now
    // crosses hallucinate (55) in a few minutes of lingering and can reach an Episode.
    veilRisePerMin: 12.0, // dense Veil-matter (deep sink)
    fogAdd: 0.03, // very low visibility
  },

  // --- Phase 8: Crust Warrens ---
  oxygen: {
    max: 100,
    secondsToEmpty: 60, // at base reserve
    suffocateHealthPerSec: 1.2,
    regenPerSec: 28, // refills quickly above ground
    depthThreshold: -9, // below this y the player is "underground"
    deepLungMult: 1.5, // A05 augment
  },

  warrens: {
    fogAdd: 0.05, // tight, dark tunnels
    crawlerPackSize: 4, // GDD: Crawlers swarm
  },

  grapple: {
    maxRange: 45,
    pullSpeed: 26,
    arriveDist: 1.6,
    timeoutSec: 1.6,
    staminaCost: 12,
  },

  weather: {
    minClearSec: 35,
    maxClearSec: 80,
    minEventSec: 22,
    maxEventSec: 42,
    ashstormChance: 0.4, // event roll: <0.4 Ashstorm
    ionSurgeChance: 0.25, // then <0.4+0.25 Ion surge (else Veil-rain) — GDD §2
  },

  combat: {
    meleeRange: 2.8,
    meleeArcDot: 0.5, // cos(~60°)
    swingCooldownSec: 0.5,
    swingStaminaCost: 8, // GDD §10.2 — normal swing
    blockedSwingStaminaCost: 15, // GDD §10.2 — a blocked swing costs more
    unarmedDamage: 6, // fallback when nothing is equipped; tools use ItemDef.toolDamage
    knockback: 2.6,
  },

  fauna: {
    maxScouts: 6,
    packSize: 3, // GDD: Scouts patrol in 3s
    spawnMinDist: 42,
    spawnMaxDist: 88,
    safeRadius: 15, // GDD §9.1 no spawns within 15m of fire/base
    respawnDelaySec: 18,
    despawnDist: 140, // far-away packs are recycled
    maxApexEncounters: 3, // GDD §9.1 apex don't respawn — finite Cradle world events
  },

  // --- Phase 12 audit: base defense (GDD §6.2) ---
  defense: {
    spikeDamagePerSec: 12, // Perimeter Spike contact damage to nearby fauna
    spikeRadius: 1.8,
  },

  // --- GDD §7.1 / §8.1 armor & equipment ---
  armor: {
    maxReduction: 0.55, // cap on total incoming-damage reduction from worn armor
    wearPerHit: 1, // armor durability lost per hit taken
  },

  // --- GDD §6.3 power grid (watt budget; solar/battery/generator) ---
  power: {
    nodeOutput: 12, // Power Node trickle (relay + small constant baseline)
    solarOutput: 55, // Solar Panel output at full daylight (scaled by daylight)
    genOutput: 48, // Generator output while it has fuel
    genFuelPerSec: 0.7, // fuel units burned per second while running
    genFuelPerUnit: 20, // fuel gained per Bioluminite when refuelling
    genFuelMax: 120,
    batteryCapacity: 2000, // stored charge (W·s) per Veil-cell Battery
    condenserDraw: 15,
    medicalDraw: 15,
    lightDraw: 6,
  },

  // --- Post-processing (atmosphere/visual pass; all tunable) ---
  postfx: {
    bloomStrength: 0.6, // glow intensity on bright/emissive areas (Veil-matter)
    bloomRadius: 0.5,
    bloomThreshold: 0.8, // only pixels brighter than this bloom (keeps the sky clean)
    vignetteStrength: 0.4, // max multiplicative darkening at the corners (0 = off)
    vignetteRadius: 0.7, // distance (0 centre .. 1 corner) where darkening starts
  },

  // --- Game feel (camera shake / impact juice) ---
  feel: {
    shakeMax: 0.32, // clamp on accumulated camera-shake magnitude (m)
    shakeDecay: 1.8, // shake magnitude lost per second
    hitShake: 0.07, // landing a melee hit
    killShake: 0.13, // slaying a creature
    hurtShake: 0.16, // taking damage (base)
    bellowShake: 0.1, // a Bellower's call
    landShakeScale: 0.012, // per m/s of impact velocity on landing
    landShakeMax: 0.18,
  },

  // --- Phase 4: tools & scanner ---
  tools: {
    meleeWearPerHit: 1.5, // GDD §10.3
    gatherWearPerHit: 0.5, // GDD §10.3
    repairAmount: 50, // GDD §10.3 restore per repair action
  },

  scan: {
    radius: 30, // GDD §11.2 30m scan radius
    durabilityCost: 4,
    markerTtlSec: 8,
    cooldownSec: 0.6,
  },

  condenser: {
    ratePerMin: 30, // water units gathered per minute when powered
    max: 100,
    drinkUnits: 25, // units consumed per drink
    drinkHydration: 25,
  },

  // --- Phase 10: endings + adaptation ---
  endings: {
    repairCost: [
      { itemId: "energy_cell", quantity: 2 },
      { itemId: "alloy_frame", quantity: 1 },
      { itemId: "ship_component", quantity: 1 },
    ],
    embraceHoldSec: 2.5, // hold to embrace the Veil during an Episode (Ending B)
  },

  adaptation: {
    apexMeleeHitThreshold: 12, // GDD §9.4 — Cradle-Spawn learns the blade
    apexMeleeResist: 0.5,
    blockPeriodSec: 4,
    blockWindowSec: 1.2,
  },
} as const;
