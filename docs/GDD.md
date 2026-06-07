# VEILBORN — Game Design Document
**Version 1.0 | Engine-Agnostic Spec**

---

## 0. Overview

**Title:** VEILBORN
**Genre:** First-Person Sci-Fi Survival
**Platform Target:** PC (primary), Console (stretch)
**Player Count:** Single-player only
**Perspective:** First-person
**Tone:** Tense, lonely, wonder-driven — heavy Subnautica influence in emotional pacing, The Forest influence in environmental threat

### Logline
You are the sole survivor of a terraforming colony ship that crashed on Vaelun — a living, breathing alien world that actively adapts to your presence. The longer you survive, the smarter it gets.

---

## 1. Core Fantasy

The player should feel:
- **Alone but not helpless** — you are skilled, resourceful, and capable
- **Like a trespasser** — the planet is not indifferent; it *notices* you
- **Pulled forward** — the mystery of what happened to the colony ship, and what Vaelun *is*, drives exploration
- **Rewarded for patience** — the game respects players who observe before acting

---

## 2. Setting

### Planet: Vaelun
A Class-3 terrestrial world orbiting a dim red dwarf star. Perpetually overcast with a faint amber-orange sky. The planet's unique feature: **Veil-matter** — a bioluminescent, semi-organic compound that saturates the soil, atmosphere, and native lifeforms. It's what makes the planet valuable. It's also what makes it dangerous.

### Biomes (5 Total)

| ID | Name | Description | Dominant Threat |
|----|------|-------------|-----------------|
| B01 | The Ashfields | Vast, open plains of grey sediment. Starting zone. Low cover. | Atmospheric storms, Scouts |
| B02 | The Spinewoods | Dense alien forest of rigid crystalline trees. Mid-game. | Ambush predators, disorientation |
| B03 | The Veil Sink | A vast depression filled with dense Veil-matter fog. Deep mid-game. | Reduced visibility, Drifters |
| B04 | The Crust Warrens | Underground tunnel network carved by megafauna. Late-game. | Cave fauna, cave-ins, oxygen |
| B05 | The Cradle | The impact zone of the colony ship. End-game. | Adaptive Apex predators |

### Tone Reference
- Day cycle: 28 in-game minutes (red-dwarf dim light)
- Night cycle: 22 in-game minutes (absolute darkness, Veil-matter glows)
- Weather events: Ashstorm, Veil-rain, Ion surge

---

## 3. Core Loop

```
Wake → Assess needs → Gather/Craft → Build/Fortify → Explore → Discover → Sleep → Repeat
```

The loop has three concentric scales:

**Micro (minutes):** Stay alive right now. Manage stats, avoid threats, gather nearby resources.
**Meso (hours):** Build and upgrade your base. Unlock new crafting tiers. Push into new biomes.
**Macro (sessions):** Uncover the lore. Find colony ship wreckage. Understand Vaelun. Reach the Cradle.

---

## 4. Survival Systems

### 4.1 Player Stats
Four primary survival meters, all decay at configurable rates:

| Stat | Range | Decay | Critical Effect |
|------|-------|-------|-----------------|
| **Health** | 0–100 | Only from damage | Death at 0 |
| **Stamina** | 0–100 | Active use; regens when idle | Sprint/climb disabled |
| **Hunger** | 0–100 | –1.5/min baseline | Health drain begins at <15 |
| **Hydration** | 0–100 | –2.5/min baseline | Health drain begins at <10 |
| **Warmth** | 0–100 | Biome + night dependent | Stamina drain, blurred vision |
| **Veil Exposure** | 0–100 | Passively rises in Veil-dense zones | Hallucinations, Drifter aggro +50% |

**Veil Exposure** is the unique sixth stat. It replaces a typical "radiation" mechanic. High exposure causes:
- Visual distortion / false movement in peripheral vision
- Audio hallucinations (distant colony ship radio chatter)
- Passive attraction of Drifter-class enemies
- At 100: a "Veil Episode" — a scripted hallucination sequence, then purge to 60

Veil Exposure is reduced by: shelter proximity, Purge Compounds (crafted), rest.

---

### 4.2 Data Structures

```
PlayerStats {
  health: float [0..100]
  stamina: float [0..100]
  hunger: float [0..100]
  hydration: float [0..100]
  warmth: float [0..100]
  veil_exposure: float [0..100]

  decay_modifiers: {
    hunger_rate: float       // default 1.5/min; modified by upgrades
    hydration_rate: float    // default 2.5/min
    warmth_rate: float       // dynamic; biome + weather driven
    veil_rate: float         // dynamic; biome density driven
  }

  active_effects: Effect[]
}

Effect {
  id: string
  name: string
  duration: float            // seconds; -1 = permanent until cured
  modifiers: StatModifier[]
  tick_damage: float         // 0 if none
}

StatModifier {
  stat: StatEnum
  operation: [ADD | MULTIPLY]
  value: float
}
```

---

### 4.3 Food & Water

**Food:**
- Raw alien organisms → cook or eat raw (raw: 50% nutrition, chance of Gut-rot effect)
- Cultivated (mid-game): grow alien crops at base, guaranteed safe
- Ration packs from ship wreckage: rare, high nutrition, no crafting required

**Water:**
- Surface collection: puddles, Veil-rain collection (requires filter)
- Underground springs (Warrens biome)
- Condensation collectors (base building, requires power)
- Veil-rain: unfiltered = drinkable but raises Veil Exposure +5

---

### 4.4 Temperature
- Ashfields day: neutral (warmth drain 0)
- Ashfields night: cold (warmth drain -1/min)
- Spinewoods: neutral
- Veil Sink: cold + wet (-1.5/min)
- Crust Warrens: warm (no drain)
- Ashstorm: severe cold snap during event (-3/min override)
- Fire at base: +2/min warmth within 8m radius
- Thermal gear (crafted): reduces drain by 0.75/min

---

## 5. Crafting System

### 5.1 Philosophy
- No recipe books — recipes are **discovered** through experimentation or lore fragments
- Crafting is done at a Fabricator (built at base) or in-field with a Survival Kit (limited)
- Items have **quality tiers**: Crude → Standard → Refined → Veil-forged
- Higher quality = more durability / better stats / new properties

### 5.2 Crafting Tiers

| Tier | Unlock Condition | Example Items |
|------|------------------|---------------|
| **Tier 0** | Available immediately | Stone blade, leaf wrap, basic shelter |
| **Tier 1** | Build base Fabricator | Alloy frame, sealed container, primitive weapon |
| **Tier 2** | Recover ship component (mid-game) | Energy cell, composite armor, scanner |
| **Tier 3** | Reach the Cradle | Veil-forged tools, full armor, signal beacon |

### 5.3 Material Categories

```
Material {
  id: string
  name: string
  category: [ORGANIC | MINERAL | SYNTHETIC | VEIL_COMPOUND]
  stack_size: int
  weight: float              // kg; affects carry capacity
  properties: string[]       // ["flammable", "conductive", "toxic", etc.]
  quality: QualityEnum
}
```

**Material Examples:**

| ID | Name | Category | Found In | Notes |
|----|------|----------|----------|-------|
| M001 | Ash-sediment | MINERAL | Ashfields | Base crafting material |
| M002 | Spine-crystal shard | MINERAL | Spinewoods | Conductive, sharp |
| M003 | Vaelun hide | ORGANIC | All biomes | Armor material |
| M004 | Veil-resin | VEIL_COMPOUND | Veil Sink, Warrens | Adhesive, also Purge Compound base |
| M005 | Ship alloy scrap | SYNTHETIC | Cradle + crash sites | High-tier crafting |
| M006 | Bioluminite | VEIL_COMPOUND | Night gatherable | Light source material |
| M007 | Spore-cap | ORGANIC | Spinewoods | Food, also toxin source |
| M008 | Condensate crystal | MINERAL | Warrens | Water source |

### 5.4 Recipe Data Structure

```
Recipe {
  id: string
  output_item: ItemRef
  output_quantity: int
  ingredients: Ingredient[]
  crafting_station: [HAND | SURVIVAL_KIT | FABRICATOR | ADV_FABRICATOR]
  unlock_condition: UnlockCondition
  craft_time: float          // seconds
  quality_output: QualityEnum
}

Ingredient {
  material_id: string
  quantity: int
  quality_minimum: QualityEnum  // null = any quality
}

UnlockCondition {
  type: [ALWAYS | LORE_FRAGMENT | EXPERIMENTATION | STATION_TIER]
  reference_id: string       // fragment ID or station tier
}
```

---

## 6. Base Building

### 6.1 Philosophy
- Modular grid-snap building (not freeform voxel)
- Grid size: 2m × 2m per tile, 3m vertical per floor
- Structures can be built on uneven terrain (auto-levels with foundation pieces)
- Structures degrade over time (weather damage); require maintenance materials

### 6.2 Module Types

| Category | Modules |
|----------|---------|
| **Foundation** | Floor plate, Raised platform, Ramp |
| **Walls** | Solid wall, Window panel, Door frame + door |
| **Roof** | Flat roof, Sloped panel |
| **Utilities** | Fabricator, Power node, Condenser, Storage crate |
| **Survival** | Fire pit, Sleeping pod, Medical station |
| **Defense** | Motion sensor, Perimeter spike, Light post |
| **Research** | Analysis bench, Signal array, Lore scanner |

### 6.3 Power System
- Power is required for: Fabricator, Condenser, Medical station, Signal array
- Power sources: Solar panel (day-only), Veil-cell battery (crafted, limited charge), Generator (fuel-hungry)
- Power grid: modules connect automatically if within 5m of a powered node
- Blackout events during Ion surges (weather) — power cut for 2–5 min

### 6.4 Base Data Structure

```
Base {
  id: string
  modules: Module[]
  power_grid: PowerGrid
  storage_inventory: Inventory
  integrity: float [0..100]  // degrades with weather damage
}

Module {
  id: string
  type: ModuleType
  position: Vector3
  rotation: float
  tier: int
  durability: float [0..100]
  powered: bool
  connections: ModuleRef[]
}

PowerGrid {
  sources: PowerSource[]
  consumers: PowerConsumer[]
  total_output: float        // watts
  total_draw: float
  status: [STABLE | OVERLOADED | OFFLINE]
}
```

---

## 7. Inventory System

### 7.1 Structure
Carry weight system (not grid-based).

```
Inventory {
  slots: InventorySlot[]     // visual representation only; actual is weight-capped
  max_weight: float          // default 30kg; upgradeable to 45kg
  current_weight: float
  equipped: EquipmentSlots
}

EquipmentSlots {
  head: ItemRef | null
  body: ItemRef | null
  hands: ItemRef | null
  tool: ItemRef | null       // active tool/weapon
  offhand: ItemRef | null    // torch, shield, scanner
}

InventorySlot {
  item: Item | null
  quantity: int
  is_hotbar: bool
}

Item {
  id: string
  name: string
  description: string
  weight: float
  stack_size: int
  durability: float [0..100] // -1 = unbreakable
  category: ItemCategory
  usable: bool
  use_action: ActionRef | null
}
```

### 7.2 Hotbar
- 6-slot hotbar (keyboard 1–6 or D-pad cycling)
- Quick-use: hold key = use item immediately (food/meds)
- Tap key = equip as active tool

---

## 8. Progression System

### 8.1 Philosophy
No XP or levels. Progression is **knowledge + gear + base**.

The player advances by:
1. **Unlocking crafting recipes** (via lore, experimentation)
2. **Upgrading base modules** (Tier 1 → Tier 2 → Tier 3)
3. **Recovering colony ship components** (story gates)
4. **Gaining passive upgrades** through the Augment system

### 8.2 Augment System
Augments are passive bonuses installed at a Medical Station. Max 5 active augments.

| ID | Name | Effect | Source |
|----|------|--------|--------|
| A01 | Iron Gut | Raw food never causes Gut-rot | Crafted (Tier 1) |
| A02 | Veil-Sense | Veil Exposure displayed in realtime; danger zones marked on HUD | Crafted (Tier 2) |
| A03 | Thermal Skin | Warmth drain reduced 40% | Loot (Warrens) |
| A04 | Carrier Frame | +10kg carry capacity | Crafted (Tier 2) |
| A05 | Deep Lung | Oxygen reserve +50% (Warrens traversal) | Crafted (Tier 2) |
| A06 | Reflex Filter | Stamina regen 25% faster | Colony ship loot |
| A07 | Veil-null | Veil Exposure gains 30% slower | Crafted (Tier 3) |
| A08 | Bone Lace | Incoming physical damage reduced 15% | Colony ship loot |

```
Augment {
  id: string
  name: string
  description: string
  slot_cost: int             // default 1; some cost 2 slots
  modifiers: StatModifier[]
  is_active: bool
}
```

---

## 9. Enemy / Fauna System

### 9.1 Design Principles
- **Fauna first, enemies second** — creatures have behaviors, territories, routines
- Creatures react to: sound, light, Veil Exposure level, time of day
- No creature spawns in saved zones (within 15m of a fire or base)
- Apex predators do not respawn after death — each one is a world event

### 9.2 Creature Roster

| ID | Name | Biome | Behavior | Aggro Trigger | Threat |
|----|------|-------|----------|---------------|--------|
| C01 | Scout | Ashfields | Pack hunter, patrols in 3s | Proximity / loud noise | Low |
| C02 | Spineback | Spinewoods | Ambush from tree canopy | Player stays in zone >2min | Medium |
| C03 | Drifter | Veil Sink | Attracted to Veil Exposure | Exposure >40 | Medium |
| C04 | Crawler | Warrens | Swarm; guards nests | Approaching nest | High |
| C05 | Bellower | Ashfields, Spinewoods | Territorial; calls others | Line of sight | High |
| C06 | Veil Wraith | Veil Sink (night only) | Stalker; phases in/out of visibility | Exposure >70 | Very High |
| C07 | Cradle-Spawn | Cradle | Aggressive, intelligent; adapts | Player presence | Apex |

### 9.3 Creature Data Structure

```
Creature {
  id: string
  name: string
  max_health: float
  move_speed: float          // m/s
  attack_damage: float
  attack_cooldown: float     // seconds
  detection_range: float     // meters
  detection_type: [SIGHT | SOUND | VEIL | COMBINED]
  behavior_state: [IDLE | PATROL | ALERT | CHASE | ATTACK | FLEE]
  home_biome: BiomeEnum[]
  spawn_conditions: SpawnCondition
  loot_table: LootEntry[]
  is_apex: bool
}

SpawnCondition {
  time_of_day: [ANY | DAY | NIGHT]
  min_player_veil_exposure: float   // 0 = always eligible
  biome_required: BiomeEnum[]
  max_active_instances: int
}

LootEntry {
  material_id: string
  quantity_range: [int, int]
  drop_chance: float         // 0.0–1.0
}
```

### 9.4 Adaptation System (Late Game)
Unique to Vaelun: creatures in the Cradle zone **adapt** to repeated player tactics.
- If player kills 3+ Crawlers with fire → Crawlers in Cradle zone gain fire resistance (+60% resist)
- If player uses melee exclusively → Cradle-Spawn learns to counter (increased block behavior)
- Tracked via a global `AdaptationLog` — resets on new game, never resets mid-run

```
AdaptationLog {
  entries: AdaptationEntry[]
}

AdaptationEntry {
  creature_id: string
  triggered_by: string       // "fire_damage", "melee_only", etc.
  effect: StatModifier
  threshold_kill_count: int  // how many kills triggered this
}
```

---

## 10. Weapon & Tool System

### 10.1 Tool Categories

| Category | Examples | Primary Use |
|----------|----------|-------------|
| **Harvesting** | Rock pick, crystal blade, Veil-cutter | Gathering materials |
| **Combat** | Spike lance, arc pistol, Veil-bow | Killing fauna |
| **Utility** | Scanner, torch, grapple hook | Exploration |
| **Consumable** | Flare, decoy canister, smoke bomb | Combat / evasion |

### 10.2 Combat
- No lock-on — fully first-person aimed
- Stamina-gated melee: each swing costs 8 stamina; blocked swing costs 15
- Ranged weapons require crafted ammo (no infinite ammo)
- Stealth: crouching reduces detection range by 50%; stalking from downwind eliminates smell-triggered aggro

### 10.3 Tool Durability

```
Tool {
  id: string
  name: string
  type: ToolType
  tier: int
  durability: float [0..100]
  damage: float
  attack_speed: float        // swings per second
  stamina_cost: float        // per use
  special_property: string | null  // "veil_damage", "silent", "penetrate_armor"
}
```

Durability loss per use:
- Harvesting: -0.5 per hit
- Combat melee: -1.5 per hit
- Combat ranged: -0.1 per shot (barrel wear)
- Repair: requires original materials at Fabricator, restores 50 durability per repair action

---

## 11. Exploration & Navigation

### 11.1 World Structure
- **No procedural generation** — handcrafted world, fully persistent
- World size: approximately 3km × 3km playable area
- Biomes transition with gradient overlap zones (~100m blend)
- Points of interest: 47 designed (crash sites, alien ruins, cave systems, old colony outposts)

### 11.2 Scanner
- Handheld device; requires power cell
- Scans environment in 30m radius
- Returns: material deposits, creature signatures, structural anomalies, lore fragments
- Scanner data saves to in-game log (the "Survey Log")

### 11.3 Navigation Tools

| Tool | Tier | Function |
|------|------|----------|
| Compass | T0 | Cardinal direction only |
| Topographic mapper | T1 | Reveals terrain in 100m radius as player explores |
| Full scanner | T2 | Full biome scan, POI markers |
| Signal tracer | T3 | Tracks ship beacon fragments; story-critical |

### 11.4 No Fast Travel
- Deliberate design choice: the planet should feel *vast* and *dangerous to traverse*
- Player can build relay camps (small secondary bases) to extend safe zones
- Grapple hook (Tier 2) enables vertical traversal in Spinewoods and Warrens

---

## 12. Narrative & Lore System

### 12.1 Story Structure

**Act 1: Emergence**
Player wakes in a crashed escape pod. Colony ship CALDERA is destroyed overhead. Objective: survive. No mission markers — player reads the environment.

**Act 2: Signals**
Player discovers the colony ship's black box fragments scattered across biomes. Piece together what happened to the crew. The planet is revealed as not just alien but *intentional* — Vaelun's ecosystem appears to have targeted the ship.

**Act 3: The Cradle**
The colony ship's primary terraforming core — the "Cradle" — landed intact in a distant biome. Reaching it reveals the truth: CALDERA's mission was to harvest Veil-matter against an existing treaty with Vaelun's indigenous (now-extinct) intelligent species. The planet's ecosystem is an automated defense system — still running.

**Ending A (Escape):** Repair the Cradle's signal array. Broadcast a distress call. Evac ship arrives. Leave Vaelun behind.
**Ending B (Integration):** Reach max Veil Exposure willingly. Survive the Veil Episode without purging. The player character becomes partially integrated with Vaelun's hive-mind. Bittersweet: the planet stops hunting you. You are no longer fully human.

### 12.2 Lore Fragment System

```
LoreFragment {
  id: string
  title: string
  type: [AUDIO_LOG | TEXT_LOG | ENVIRONMENTAL | CREW_RECORDING]
  source_crew_member: string | null
  content: string
  location: Vector3
  biome: BiomeEnum
  act_relevance: int         // 1, 2, or 3
  found: bool
}
```

47 total lore fragments distributed across the world. Finding all 47 unlocks the "First Contact" epilogue slide.

### 12.3 Key Characters (Audio/Text only — no NPCs)

| Name | Role | Fate |
|------|------|------|
| Dr. Yena Ash | Chief Terraformer | Survived crash; died in Warrens |
| Commander Tolc | Ship captain | Died on impact |
| Kai Renner | Veil-matter researcher | Unknown; final log in Cradle |
| ARIA | Ship AI (fragmented) | Partially functional in crashed modules |

---

## 13. HUD & UI Design

### 13.1 HUD Philosophy
- Minimal by default — stats only appear when critical or changing
- No floating waypoint markers (exploration-driven)
- All essential info available in the Survey Log (pause menu)

### 13.2 HUD Elements

| Element | Visibility Rule | Position |
|---------|-----------------|----------|
| Health bar | Always visible when <50; flash when <20 | Bottom left |
| Hunger/Hydration | Pulse when <25; hidden otherwise | Bottom left |
| Warmth | Icon only; glows red when cold | Bottom left |
| Veil Exposure | Vein-like visual creep on screen edge | Screen border |
| Stamina | Only visible during sprint/climb | Bottom center |
| Tool durability | Only when tool equipped | Bottom right |
| Hotbar | Always visible | Bottom center |

### 13.3 Menus
- **Survey Log:** Crafting recipes (known), augments, lore fragments, world map (explored areas), creature log
- **Fabricator UI:** Drag-and-drop materials → craft output; shows all unlocked recipes
- **Build Mode:** Snap-grid overlay; material cost shown per module; ghost placement with red/green validity

---

## 14. Audio Design Direction

### 14.1 Principles
- **Diegetic priority** — most UI sounds should feel like they come from the world (scanner beeps, fabricator hum)
- **Silence as tension** — Veil Sink and Warrens should feel eerily quiet; player footsteps prominent
- **Adaptive music** — no traditional OST; generative ambient layers that shift with threat level and Veil Exposure

### 14.2 Adaptive Music States

| State | Trigger | Audio Layer |
|-------|---------|-------------|
| Calm | No threats, base nearby | Sparse tonal drones |
| Explore | Moving in safe zone | Rhythmic ambient, low frequency |
| Threat Nearby | Creature within 30m | Percussion added, tension rise |
| Combat | Active engagement | Full tension layer, no melody |
| Veil Episode | Exposure at 100 | Fragmented radio static + ship voices |
| Night | Time of day | Deepened, slower layers |

---

## 15. Save System
- **Manual save at Sleeping Pod only** — cannot save in open world
- One save slot (permanent death is not enabled, but danger of not saving is real)
- Auto-save on: base module construction, lore fragment collection, biome transition
- Save file stores: player stats, inventory, base state, world state (POI discovered, creatures killed, adaptation log), lore found

---

## 16. Settings & Accessibility

| Option | Default | Range |
|--------|---------|-------|
| Hunger/Thirst decay rate | 1.0x | 0.25x – 2.0x |
| Creature aggression | Normal | Passive / Low / Normal / High |
| Veil Exposure rate | 1.0x | 0.0x – 2.0x |
| Compass always on | Off | Toggle |
| FOV | 90° | 70°–110° |
| Head bobbing | On | Toggle |
| Subtitles | On | Toggle |
| Sprint toggle | Off | Toggle |
| High-contrast biome markers | Off | Toggle |

---

## 17. Phased Build Plan

### Phase 1: Core Player Loop
- First-person controller (walk, sprint, crouch, jump)
- Player stats: Health, Stamina, Hunger, Hydration
- Basic inventory (weight-based, 6-slot hotbar)
- Hand-crafting (Tier 0 recipes only)
- Day/night cycle
- Placeholder Ashfields zone (1km × 1km greybox)

### Phase 2: Base Building
- Modular snap-grid building system
- Foundation, wall, roof, door modules
- Fire pit (warmth source + safe zone)
- Sleeping pod (save trigger)
- Basic storage crate
- Power node (no consumers yet)

### Phase 3: Survival Threats
- Warmth stat + temperature zones
- Veil Exposure stat (visual effect only at this phase)
- Weather events: Ashstorm, Veil-rain
- Scout creature (C01): patrol, aggro, attack, flee
- Basic combat: melee swing, damage, death

### Phase 4: Crafting + Resources
- Fabricator building module
- Tier 1 recipe unlock system
- 8 core materials (M001–M008) with gather interactions
- Scanner (Tier 1): material detection only
- Tool durability + repair

### Phase 5: World Build — Spinewoods
- Spinewoods biome (full art pass)
- Spineback creature (C02): ambush behavior
- Bellower creature (C05): territorial + call behavior
- Lore fragments 1–15 placed
- Topographic mapper (Tier 1)

### Phase 6: Mid-Game Systems
- Augment system (Medical Station + 8 augments)
- Full Tier 2 crafting
- Colony ship crash sites (3 POI)
- Condensation collector + water system
- ARIA fragments (first 3 audio logs)

### Phase 7: Veil Sink + Late World
- Veil Sink biome (full art pass)
- Drifter creature (C03)
- Veil Wraith creature (C06)
- Full Veil Exposure effects (hallucinations, screen distortion)
- Veil Episode scripted sequence
- Purge Compound crafting

### Phase 8: Crust Warrens
- Underground traversal (Warrens biome)
- Oxygen system (underground only)
- Crawler swarm creature (C04)
- Grapple hook
- Condensate crystal water source
- Dr. Yena Ash lore arc (fragments 16–30)

### Phase 9: Narrative Layer
- Lore fragment reader UI (Survey Log)
- ARIA full dialogue tree
- Black box fragment system (Act 2 story beats)
- Signal Tracer tool
- Cradle zone (greybox + creature placeholder)

### Phase 10: The Cradle + Endings
- Cradle biome (full art pass)
- Cradle-Spawn apex creature (C07) + adaptation system
- Ending A implementation: signal array repair sequence
- Ending B implementation: Veil integration sequence
- Final lore fragments 31–47
- Credits + epilogue slides

### Phase 11: Polish Pass
- Adaptive music system
- Full audio pass (ambience, creature SFX, UI diegetic sounds)
- Full HUD polish (conditional visibility rules)
- Save/load system hardening
- Accessibility options menu
- Settings + difficulty sliders

### Phase 12: QA + Balance
- Survival stat tuning (playtesting decay rates)
- Creature balance pass
- Lore fragment coverage audit
- Platform optimization
- Final bug pass

---

## 18. Out of Scope (V1)
The following are explicitly excluded to maintain scope:
- Multiplayer of any kind
- Procedurally generated worlds
- Vehicle system
- Building raiding / destruction by enemies (structure damage is weather-only)
- NPC companions
- New Game+ mode
- Mobile platform

---

*End of Document — VEILBORN GDD v1.0*
