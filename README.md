# VEILBORN — Prototype (Phases 1–12, complete)

**▶ Play it in your browser: https://stobieee-bit.github.io/veilborn/** (click the title screen to lock the mouse and play)

A playable first-person survival prototype for **VEILBORN**, built with **Three.js + TypeScript + Vite**. This implements **all 12 phases** of the GDD build plan (§17) — the prototype is **content-complete, beatable, polished, and balanced**: the full survival/crafting/base loop across all five biomes, the narrative layer, **both endings**, an adaptive procedural soundtrack + full SFX pass, strict conditional HUD, autosave, an accessibility + difficulty options menu, and a final QA + balance pass (survival-economy tuning, a verified bug sweep, and a forward-rendering performance optimization).

> The full game design lives in [`docs/GDD.md`](docs/GDD.md). This prototype is engine-agnostic spec → concrete web build.

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

Other scripts:

```bash
npm run build      # type-check + production bundle into dist/
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

Click the title screen to lock the pointer and play. Press **Esc** to release the pointer (the sim pauses); click to resume.

## Controls

| Action | Input |
|--------|-------|
| Move | `W` `A` `S` `D` |
| Sprint | Hold `Shift` (drains stamina) |
| Crouch | Hold `Ctrl` or `C` |
| Jump | `Space` (costs stamina) |
| Look | Mouse |
| Attack (melee swing) | Left click |
| Scan (when Scanner equipped) | Left click |
| Interact (gather / drink / use station) | `E` |
| Use hotbar slot | `1` – `6` |
| Inventory / Field Crafting | `Tab` |
| Survey Log (journal) | `J` |
| How to Play (help) | `H` |
| Settings / Accessibility | `O` |
| Build mode (toggle) | `B` |
| — cycle module | Mouse wheel / `Q` `E` |
| — rotate module | `R` |
| — place module | Left click |
| Rest & Save (at Sleeping Pod) | `E` |
| Open Storage (at Crate) | `E` |
| Pause look | `Esc` |

On the title screen, **New Game** starts fresh; **Continue** appears when a save exists; **Settings** opens the accessibility/difficulty menu (also reachable in-game with `O`).

## What's in (Phase 1, GDD §17)

- **First-person controller** — walk / sprint / crouch / jump, gravity, terrain-following ground collision, cylinder collision against large props, world-bounds clamp, and a held-tool viewmodel.
- **Survival stats** (GDD §4.1) — Health, Stamina, Hunger, Hydration with GDD decay rates (hunger −1.5/min, hydration −2.5/min), critical-threshold health drain, stamina drain/regen. *Warmth and Veil Exposure are intentionally deferred to Phase 3.*
- **Weight-based inventory + 6-slot hotbar** (GDD §7) — 30 kg cap, auto-assign of usable items to the hotbar, tap-to-equip tools / tap-to-use consumables / tap-to-deploy placeables.
- **Tier-0 hand crafting** (GDD §5) — Stone Blade, Fiber Wrap, Shelter Kit, with live ingredient availability in the Survey Log panel.
- **Gathering loop** — ore (Ash-sediment), fronds (Fiber-frond), spore-caps (food), and Veil Springs (drink) scattered as depletable nodes.
- **Day/night cycle** (GDD §2) — animated sun arc, amber overcast sky gradient, fog, and Veil-matter crystal glow that rises at night.
- **HUD** (GDD §13) — crosshair with target highlight, stat cluster, clock, interaction prompt, hotbar, toasts, intro/death/pause overlays.
- **Ashfields greybox** (B01) — 1 km × 1 km rolling terrain with instanced rock & crystal scatter and ~126 resource nodes.

## What's in — Phase 2 (GDD §6, §15, §17)

- **Modular snap-grid building** (GDD §6.1) — 2 m grid, 3 m floors, ghost preview with green/red validity and live material cost. Modules: Foundation, Wall, Doorway, Roof, Fire Pit, Sleeping Pod, Storage Crate, Power Node.
- **Real placement rules** — walls/doorways snap to foundation edges, roofs to the floor above, props to cells; foundations become walkable surfaces and walls/doorways block the player (doorways leave a walkable gap).
- **Fire Pit** — point-light + ember glow + a safe-zone marker (warmth wiring arrives with the Phase 3 stat).
- **Sleeping Pod** — `E` to rest until dawn (restores stamina + a little health) and **save the game** (GDD §15: manual save at the pod).
- **Storage Crate** — `E` to open a transfer panel (200 kg) between you and the crate.
- **Power Node** (GDD §6.3) — powers modules within 5 m (radius ring shown); no consumers yet, per the phase plan.
- **Save / load** — full state to `localStorage` (stats, inventory, hotbar, player pose, time of day, placed modules + crate contents, depleted nodes); **Continue** on the title screen.

## What's in — Phase 3 (GDD §4, §9, §10, §17)

- **Warmth stat** (GDD §4.4) — neutral in Ashfields day, drains at night (−1/min) and harder in an Ashstorm (−3/min); a **Fire Pit warms** you (+2/min within 8 m). Cold (<25) saps stamina and frosts/blurs vision; freezing (<6) drains health.
- **Veil Exposure stat** (GDD §4.1, visual-only this phase) — rises near crystal clusters and during Veil-rain, decays near shelter/fire. Drives a **vein-like teal creep** on the screen border. (Drifter aggro / Veil Episodes are Phase 7.)
- **Weather** (GDD §2) — a Clear ↔ event cycle of **Ashstorm** (cold + ash particles + low visibility) and **Veil-rain** (raises Veil Exposure), with a HUD chip.
- **Scout fauna** (C01, GDD §9) — packs of 3 with a full behaviour FSM (PATROL → ALERT → CHASE → ATTACK, FLEE when wounded), proximity detection (halved while crouching), pack alerts, and loot (Vaelun Hide). They never spawn within 15 m of a fire or the pod (GDD §9.1).
- **Melee combat** (GDD §10) — left-click swing (8 stamina, with viewmodel animation), arc + range hit detection, knockback, and creature attacks that damage and can kill the player (the death screen).
- **HUD additions** — Warmth bar, Veil/cold screen overlays, a damage flash, a weather chip, and a "⚠ HUNTED" threat cue.

## What's in — Phase 4 (GDD §5, §10.3, §11.2, §17)

- **Fabricator module** (GDD §5.1) — a new buildable; interact (`E`) opens the Fabricator panel. Building one unlocks Tier-1 crafting.
- **Tier-1 recipe discovery** (GDD §5.1, "no recipe books") — recipes reveal by **experimentation**: a Fabricator recipe is discovered the first time you hold all its ingredients (and a Fabricator exists). Known recipes persist in the save.
- **All 8 core materials** (GDD §5.3, M001–M008) gatherable in the Ashfields: Ash-sediment, Spine-crystal Shard, Vaelun Hide, Veil-resin, Ship Alloy Scrap, Bioluminite (night-gathered), Spore-cap, Condensate Crystal (drinkable water source).
- **Tier-1 craftables** — Alloy Frame (component), Spike Lance (stronger weapon), and the Scanner.
- **Scanner** (GDD §11.2, Tier-1) — equip and left-click to ping a 30 m radius; detected deposits get floating markers. Costs durability per scan.
- **Tool durability + repair** (GDD §10.3) — tools wear with use (melee −1.5/hit, harvesting −0.5/hit) and **break** at 0; the bottom-right durability bar shows the held tool. Repair at the Fabricator restores +50 for the item's recipe materials.

## What's in — Phase 5 (GDD §2, §9, §11.3, §12, §17)

- **The Spinewoods (B02)** — a circular biome region with a ~100m gradient blend (GDD §2): a darker floor, denser fog (disorientation), and a forest of instanced crystalline trees (with trunk collision). A HUD biome chip names where you are.
- **Spineback (C02)** — Spinewoods ambush predator: lurks near the trees, then **bursts** when you stray within range or linger past ~2 minutes (GDD §9.2).
- **Bellower (C05)** — territorial caller (both biomes): on first sight it **bellows**, rousing every creature within 60m to your position; high threat, never flees.
- **Biome-aware spawns** — Scouts in the Ashfields, Spinebacks in the Spinewoods, the occasional Bellower in either.
- **Lore fragments 1–15** (GDD §12.2) — floating collectibles across both biomes; recover (`E`) to read them (title / crew / content) and track `N / 47`. Collected set persists in the save. (The full archive reader is Phase 9.)
- **Topographic Mapper** (GDD §11.3, Tier-1 craftable) — while carried, charts terrain within 100m as you explore, shown on a corner **minimap** with biome tint, fog-of-war, and a player marker. Explored area persists in the save.

## What's in — Phase 6 (GDD §5.2, §6.3, §8.2, §11.1, §12, §17)

- **Augment system** (GDD §8.2) — 8 passive augments installed at a **Medical Station** (max 5 slots; Veil-null & Bone Lace cost 2). Effects are live: carry +10kg, stamina regen ×1.25, warmth drain ×0.6, veil rise ×0.7, damage taken ×0.85, Veil-Sense HUD readout, and Iron Gut (negates Gut-rot — raw spore-caps now have a 30% Gut-rot chance without it).
- **Tier-2 crafting** (GDD §5.2) — recovering a **Ship Component** unlocks Tier-2; the Energy Cell and the craftable augments (Iron Gut T1, Veil-Sense/Carrier/Deep-Lung T2, Veil-null T3) then discover by experimentation at the Fabricator.
- **3 crash-site POIs** (GDD §11.1) — CALDERA debris fields with a one-time salvage container giving alloy, a Ship Component, and a colony-ship-loot augment (Reflex Filter / Bone Lace / Thermal Skin). Recovered state persists.
- **Power finally matters** (GDD §6.3) — the **Condenser** and Medical Station only work when within 5m of a Power Node. The Condenser slowly collects water while powered; interact to drink.
- **ARIA's logs** — 3 black-box audio logs (lore fragments 16–18) at the crash sites, advancing the Act-2 "treaty / harvester" reveal (now 18/47 placed).

## What's in — Phase 7 (GDD §2, §4.1, §9, §17)

- **The Veil Sink (B03)** — a fog-choked basin (a real terrain depression) with a deep teal floor, very low visibility, glowing veil-matter pods, and **high passive Veil Exposure** (+7/min deep) plus cold/wet warmth drain (−1.5/min).
- **Drifter (C03)** — floats over the fog and is **drawn to Veil Exposure**: it homes in from well beyond normal detection once your exposure passes 40 (and can be drawn to you anywhere at very high exposure).
- **Veil Wraith (C06)** — night-only stalker that **phases in and out of visibility** (untargetable while faded), drawn at exposure > 70, very high threat; despawns at dawn.
- **Full Veil-Exposure effects** (GDD §4.1) — the screen-edge creep intensifies, peripheral **hallucinations** flicker, and garbled radio chatter surfaces past ~55 exposure.
- **Veil Episode** — at exposure 100 a scripted veil-storm overlay with fragmented CALDERA voices takes over, then purges you to 60.
- **Purge Compound** (GDD §4.1, Tier-1 craftable from Veil-resin) — a consumable that flushes −45 Veil Exposure.

## What's in — Phase 8 (GDD §2, §4, §9, §11.4, §12, §17)

- **The Crust Warrens (B04)** — a deep, enclosed pit (a ~30m terrain basin under a rock roof with a central entrance shaft, support columns, and stalactites): warm (no warmth drain), tight fog, lit by amber pools and glowing nests.
- **Oxygen system** — a 6th survival meter that **only depletes underground** (below −9m), refills above ground, and drains health once it hits 0. **Deep Lung (A05)** now matters: +50% reserve.
- **Crawler (C04)** — fast swarm fauna (packs of 4) around nests on the Warrens floor; weak alone, relentless together.
- **Grapple hook** (GDD §11.4, Tier-2 craftable) — equip and left-click to **zip toward whatever you aim at**, for vertical traversal (climb out of the pit / up trees and pillars).
- **Condensate Crystal water** (GDD M008) — the Warrens' water source; gather and drink for hydration.
- **Dr. Yena Ash lore arc** (GDD §12) — 12 fragments (19–30) tracing her descent and death in the Warrens; now **30/47** placed.

## What's in — Phase 9 (GDD §11.3, §12, §13.3, §17)

- **Survey Log** (`J`) — the GDD §13.3 journal with four tabs: **Story** (current act + objective + a beat log), **Lore** (the recovered-fragment archive, readable full text, N/47), **Creatures** (a dossier that fills in as you encounter each species), and **ARIA**.
- **ARIA dialogue tree** (GDD §12.3) — talk to the fragmented ship AI; topics open up as the story advances (gated by act and by black-box recovery), with asked-state tracking.
- **Black-box / Act progression** (GDD §12.1) — recovering a black-box fragment advances the story to **Act 2**; reaching the Cradle advances to **Act 3**, each firing a journal beat + objective change.
- **Signal Tracer** (GDD §11.3, Tier-2 craftable) — while carried, a top-screen arrow points toward the nearest un-recovered black box, then to the Cradle's **Signal Array** once they're all found.
- **The Cradle (B05)** — a greyboxed impact zone: the broken terraforming core (red-glowing), scattered hull wreckage, the Signal Array landmark, and a placeholder **Cradle-Spawn** apex (C07) — its adaptation system arrives in Phase 10.

## What's in — Phase 10 (GDD §9.4, §12.1, §17)

- **Cradle-Spawn adaptation** (GDD §9.4) — fight the apex with melee and the species **learns**: once you've killed one (or landed enough hits), new Cradle-Spawns take **half melee damage** and periodically **block** your strikes outright (a blue shield flash; the hit is negated). Tracked in an adaptation log that persists across the run.
- **Ending A — Escape** — recover the parts (2 Energy Cells, 1 Alloy Frame, 1 Ship Component), interact with the Cradle **Signal Array** to repair + broadcast, and an evac sequence plays out.
- **Ending B — Integration** — let Veil Exposure crest to 100 and, during the **Veil Episode**, *hold F to embrace* instead of enduring; you integrate with Vaelun's hive-mind.
- **Final lore (31–47)** — Kai Renner's arc at the Cradle and the first-people reveal; **all 47** now placed. Recovering every fragment adds the **First Contact** epilogue slide to your ending.
- **Endings + credits slides** — a click-through ending/epilogue/credits sequence that returns to the title.

## What's in — Phase 11 (GDD §13.2, §15, §16, audio pass, §17)

- **Adaptive procedural soundtrack** — a layered Web Audio score (drone / pad / tension / percussion) that **reads the situation** and crossfades between five states: *calm* (near a fire/safe zone), *explore*, *threat* (fauna nearby), *combat* (being hunted up close), and *episode* (the Veil-storm). Night shifts the mix. No audio assets — every layer is synthesised at runtime.
- **Full SFX pass** — procedurally-synthesised footsteps (cadence tracks walk/sprint), gathering, crafting, building, lore pickup, melee hits, taking damage, the Bellower's call, scanner ping, and diegetic UI clicks. Audio unlocks on the first click/gesture (browser autoplay policy).
- **Strict conditional HUD** (GDD §13.2) — stat bars now **hide when healthy and surface only when they matter** (health <50, hunger/hydration <25, warmth when cold, stamina while sprinting, oxygen underground), brightening to *attention* / *critical*. The accessibility menu can force them always-on.
- **Autosave** (GDD §15) — the game now quietly saves on **building a module, recovering lore, and crossing a biome threshold** (throttled), with a brief "✓ Saved" indicator — on top of the manual Sleeping-Pod save. Loading is hardened: a corrupt/unreadable save falls back to a fresh run instead of crashing.
- **Accessibility + difficulty menu** (GDD §16) — a Settings panel (title screen or `O`): master **volume / mute**, **FOV**, **head-bob** toggle, **sprint toggle vs hold**, **subtitles** (gates the Veil radio chatter), **always-show-stats**, **high-contrast** UI, and difficulty sliders — **hunger/hydration decay rate**, **Veil-exposure rate**, and **fauna aggression** (Passive disables attacks/spawns; Low/Normal/High scale spawn rate + damage). Settings persist separately from the save.

## What's in — Phase 12 (GDD §17 — QA + Balance)

The final pass. Every core system was exercised through a runtime QA battery (driving the live game via the dev handle) and the economy was re-derived from the config:

- **Bug fix — false "underground" in the Veil Sink.** The open Veil Sink basin dips to ~−11 m, below the −9 m oxygen depth threshold, so the depth-only check wrongly treated it as enclosed: the player slowly **suffocated in an open-air biome** and the Sink's "cold + wet" warmth drain was suppressed. Oxygen is now gated on actually being in the **Crust Warrens** region (`isUnderground()` = below the threshold **and** inside the Warrens), so the Sink correctly drains warmth and never touches oxygen, while the Warrens behaves as before. Verified in both biomes.
- **Balance — the Veil Sink is now genuinely dangerous.** Its Veil-matter rise was +7/min, only **+5/min net** after baseline decay, so the signature **Veil Episode took ~20 real minutes** to reach and was effectively never seen at the prototype's compressed timescale. Raised to +12/min (**~+10/min net**): hallucinations begin after ~5–6 min in the deep Sink and an Episode is reachable in ~10 — and the faster exposure now feeds the Drifter's exposure-draw aggro, so the biome's threats compound as intended.
- **Performance — distant-light culling.** Forward rendering uploads every visible light to every material's shader regardless of distance, so the 9 Warrens/Cradle light pools cost on every fragment even from across the map. They now switch off by player distance (`World.updateBiomeLights`), dropping the common-case Ashfields scene from **17 → 8 active lights** and re-enabling each biome's pools as you approach. (No shadow maps are used; the instanced rock/crystal/tree scatter is 2,596 instances across 6 draw calls.)
- **QA battery — all green.** Verified: save/load full round-trip (zero field drift), difficulty extremes (Passive zeroes damage + halts spawns, High amplifies), augment slot math (5 slots, cost-2 augments, double-install + over-slot guards), inventory weight cap + partial adds + carrier-frame bonus, stat clamping, tool break-on-use, **both endings** reachable (escape consumes the parts; integration via hold-F), the Veil Episode (trigger → purge-to-60), oxygen suffocation + refill, freezing health drain, and tier/station-gated recipe discovery.
- **Cleanup** — removed dead config (`combat.bladeDamage`, superseded by per-tool `ItemDef.toolDamage`).

## Project structure

```
src/
  config.ts            All tunable constants (speeds, decay rates, time scale)
  core/
    types.ts           GDD data structures (items, recipes, enums)
    math.ts            clamp/lerp, deterministic hash, terrain height field
    biomes.ts          Biome regions + spinewoodsFactor / biomeAt
  data/
    items.ts           Item registry (materials, tools, consumables, augments)
    recipes.ts         Tier-0 / 1 / 2 / 3 recipes
    modules.ts         Base-building module catalog + mesh factories
    creatures.ts       Creature defs (Scout/Spineback/Bellower/Drifter/Wraith/Crawler/Cradle-Spawn)
    lore.ts            All 47 lore fragments
    augments.ts        8 augment defs (GDD §8.2)
    crashsites.ts      3 crash-site POI defs
    aria.ts            ARIA dialogue topics
  systems/
    SurvivalStats.ts   6 stats incl. Warmth + Veil Exposure
    Inventory.ts       Weight-capped inventory (+augment bonus) + durability
    Crafting.ts        Recipe resolution (station + knowledge filtered)
    Knowledge.ts       Known recipes + experimentation discovery (tier-gated)
    Augments.ts        Installed augments + effect getters
    CrashSites.ts      POI debris + one-time salvage + recovered tracking
    Narrative.ts       Act/objective/beats, ARIA-asked + creature-encounter tracking
    Adaptation.ts      Cradle-Spawn tactic-adaptation log (GDD §9.4)
    Weather.ts         Clear/Ashstorm/Veil-rain state machine + particles
    Lore.ts            Fragment pickups + collected tracking
    MapSystem.ts       Explored-grid fog of war
    SaveSystem.ts      localStorage save/load
    AudioSystem.ts     Web Audio adaptive music layers + procedural SFX
    Settings.ts        Accessibility/difficulty settings + localStorage persist
  building/
    BuildSystem.ts     Grid snap, ghost, placement, collision/surface provider, power
  fauna/
    Creature.ts        Creature instance + behaviour FSM (+ ambush/caller) + mesh
    FaunaSystem.ts     Biome-aware spawning, pack/caller alerts, melee resolution
  player/
    Input.ts           Keyboard + pointer-lock mouse + buttons/wheel
    PlayerController.ts FP movement, collision, viewmodels, pose save/restore
    Interaction.ts     Center-screen raycast (nodes / modules / lore)
  world/
    World.ts           Terrain, biome tint, props, trees, nodes, colliders, lights
    DayNightCycle.ts   Sun/sky/fog/glow animation
    SkyDome.ts         Gradient sky shader
  ui/
    HUD.ts             DOM HUD overlay (+ biome chip, durability bar)
    CraftingMenu.ts    Survey Log / Fabricator panel
    BuildHUD.ts        Build-mode panel (module, cost, validity)
    StorageUI.ts       Storage crate transfer panel
    LoreReader.ts      Lore fragment popup reader
    Minimap.ts         Topographic Mapper minimap canvas
    AugmentUI.ts       Medical Station install/uninstall panel
    SurveyLog.ts       Journal: Story / Lore / Creatures / ARIA tabs
    EndingScreen.ts    Ending / epilogue / credits slides
    SettingsMenu.ts    Accessibility/difficulty options panel
    styles.css
  Game.ts              Orchestration + frame loop
  main.ts              Bootstrap
```

## Notable prototype decisions

These are deliberate simplifications, flagged in-code, to be revisited later:

- **Time is compressed** — `CONFIG.time.secondsPerFullDay = 240` (a 4-minute cycle) for demonstrability. Set to `3000` for the GDD-canonical 28 min day / 22 min night.
- **HUD now hides healthy stats** (Phase 11) — GDD §13.2 conditional visibility is implemented: bars surface only when relevant (low, sprinting, underground) and brighten to attention/critical. The **always-show-stats** accessibility toggle restores the old always-on cluster for first-time players.
- **Materials & craftables share one item type** — the GDD separates `Material` and `Item`; the prototype unifies them so everything an inventory holds shares one shape.
- **One merged stack per item** — `stackSize` is carried as data but the hard limit is carry weight; split-stack UI comes later.
- **Foundations auto-level into flat platforms** (GDD §6.1 "auto-levels") — a foundation placed next to existing ones inherits their top height (8-neighbour check in `BuildSystem.adjacentFoundationTop`), so connected tiles form one continuous flat surface instead of stepping with the terrain slope; an isolated foundation still sits on raw terrain. Legs may visibly float/clip where the ground falls away under a level platform (cosmetic). Roofs are visual/overhead (not yet walkable).
- **Single save slot** — one `localStorage` slot. Manual save at the Sleeping Pod plus **autosave** (Phase 11) on building, lore recovery, and biome transition (throttled). A corrupt save now falls back to a fresh run rather than crashing.
- **Structure integrity is tracked but not yet degraded** — weather damage arrives with Phase 3 weather events.
- **Shelter Kit (Tier-0 craftable) still deploys a static lean-to** — superseded by the build system but kept as a craftable.
- **Night keeps a low ambient floor** so the world is navigable before the torch/light tools of Phase 4.
- **Veil Exposure sources are the lit crystal clusters near spawn** (the 5 `veilLights`); a full veil-density field arrives with the Veil Sink in Phase 7.
- **Materials M002/M004/M005/M006/M008 canonically belong to later biomes** but are scattered through the Ashfields now so all 8 are gatherable in Phase 4.
- **Tools merge by item id** (one stack per type); durability lives on that stack. Holding two of the same tool would share one durability value — fine in practice since you rarely carry duplicates.
- **The Scanner skips the GDD power-cell requirement** for now (energy cells are Tier 2); it consumes its own durability per scan instead.
- **The Spinewoods is a circular greybox region** inside the 1km map, not a separate handcrafted 3km area; biome belonging is computed from `spinewoodsFactor(x,z)`.
- **Lore reader is a single-fragment popup** on pickup; the full Survey-Log archive/reader is Phase 9. All 47 fragments exist as a target count; 15 are placed now.
- **The Topographic Mapper is passive** — owning it (not equipping) enables the minimap. Other navigation tools (full scanner POI markers, signal tracer) are later tiers.
- **Tier-2 unlock is a one-way flag** set when any Ship Component is first recovered (not by holding the item), so spending the component doesn't relock the tier.
- **Armor auto-equips the best piece per slot** rather than via a manual loadout screen — a deliberate prototype simplification of the GDD's `EquipmentSlots`. The worn set is derived from inventory, so it needs no separate save state and always reflects your best gear. (Offhand armor is out of scope; the held tool is the only "hand" item.)
- **Power is gated only for the Phase-6 modules** (Medical Station, Condenser); the Fabricator stays power-free to preserve Phase-4 behaviour. Deep Lung (A05) is installable but inert until the Phase-8 oxygen system.
- **Veil Episode auto-purges to 60** unless you *hold F to embrace* (Ending B, Phase 10). The Veil hallucination radio chatter is delivered as on-screen subtitles (Phase 11 audio adds the adaptive *episode* music layer); the subtitle toast can be turned off in Settings.
- **Audio is fully procedural** (Phase 11) — music and SFX are synthesised with the Web Audio API (oscillators / filtered noise), so there are no sample assets to ship. The context unlocks on the first user gesture per browser autoplay rules.
- **The Veil Sink and Crust Warrens are circular greybox regions** (terrain bowls via `terrainHeight`), not separate handcrafted levels. The Warrens is an enclosed pit (rock roof + shaft) rather than a true tunnel network. "Underground" (which drives the oxygen system) is being below the −9 m depth threshold **and** inside the Warrens region — the Phase-12 region gate stops the deeper-than-−9 Veil Sink basin from being mistaken for enclosed cave.
- **Act is derived, not set** — Act 2 from any black-box recovered, Act 3 from reaching the Cradle.
- **Adaptation models the melee path** (the only weapon path implemented) — GDD's fire-resistance branch is structured-for but not triggerable without a fire weapon. Ending B is reached by *holding F* during a Veil Episode (the "don't purge / embrace" choice); endings return to the title and keep your save.

## Status — all 12 GDD build phases complete

The prototype now covers the full GDD §17 build plan end to end: the survival/crafting/base loop, all five biomes, seven creatures (incl. the adapting apex), the narrative + lore archive, both endings, the audio + accessibility polish layer, and a final QA + balance pass. It is playable start to finish and beatable by either ending.

### Post-build audit (in-scope polish)

A recursive GDD-conformance / dead-code / performance audit after Phase 12 landed these in-scope fixes:

- **Tier-3 now unlocks at the Cradle** (GDD §5.2). The flag was never set, so the entire Veil-null augment chain (recipe → item → A07 effect) was unreachable; reaching the Cradle now flips it, with save back-compat.
- **Veil-Sense (A02) marks danger zones** (GDD §8.2) — the HUD readout flags "⚠ DENSE ZONE" in crystal clusters / the Veil Sink, not just the exposure number.
- **Scanner detects lore + creatures** (GDD §11.2), not only material deposits — colour-coded pings (teal deposits, amber lore, red fauna).
- **Blocked melee swings cost 15 stamina** vs 8 for a normal swing (GDD §10.2).
- **Deep Lung** reads its multiplier from config (single source of truth).
- **Performance:** removed the steady-state per-frame GC pressure and the two broadest scans — the 208-node interaction raycast list and fire-position lookups are cached and rebuilt only on change; movement / sun / fog vector+colour scratch is hoisted out of the loop; the hotbar only touches the DOM when a slot changes (was ~18 `querySelector`s/frame). Combined with the Phase-12 biome-light culling (17 → 8 active lights in the Ashfields).
- **Dead code removed:** an unused config block plus several orphaned methods/getters.

### Discrepancy pass (further GDD conformance)

A follow-up GDD read-through closed these:

- **Apex predators no longer respawn** (GDD §9.1) — the Cradle-Spawn is now a finite world event (cap of 3 per run, tracked via the persisted apex-kill count) instead of respawning indefinitely.
- **Creature `detectionType` is now behavioural** (GDD §9.3) — Veil-hunters (Drifter, Wraith) see poorly and rely on Veil-draw; the apex's Combined senses make crouching less effective. (Previously every creature used one uniform sight range.)
- **Compass** (GDD §11.3, §16) — a cardinal + bearing heading readout, shown via the new **"Compass always on"** accessibility toggle (the one §16 option that was missing).
- **Ashstorm is a cold-snap override** (GDD §4.4) — it replaces the day/night ambient warmth drain instead of stacking on top of it.
- **Base defense modules** (GDD §6.2 Defense) — **Light Post** (base lighting) and **Perimeter Spike** (chips nearby non-apex fauna) are buildable.
- **Torch** (GDD §10.1) — a Bioluminite-crafted equippable light source (doubles as a weak bludgeon).
- **Cooking + ration packs** (GDD §4.3) — interact with a **Fire Pit** to cook raw Spore-caps into the safe, higher-nutrition Cooked Spore-cap; **Ration Packs** are salvageable from crash sites.

### Armor & equipment + final conformance

A second discrepancy pass added the one genuinely missing *layer* plus several small spec items:

- **Armor / equipment** (GDD §7.1, §5.2, §8.1) — a worn-armor system across head / body / hands with incoming-damage reduction (capped), durability that degrades when hit (broken pieces fall off), and a HUD readout. Craftable pieces span the tiers: **Hide Vest** (T1) → **Alloy Helm / Reinforced Gauntlets / Composite Vest** (T2) → **Veil-forged Cuirass** (T3). To avoid an extra loadout UI, each slot **auto-equips the best unbroken piece you carry** (so the worn set is derived from inventory and needs no separate save state).
- **Rest reduces Veil Exposure** (GDD §4.1) — sleeping at the pod now lowers exposure (−30) alongside restoring stamina/health.
- **Veil-rain is drinkable** (GDD §4.3) — with no interaction target while Veil-rain falls, press `E` to drink: hydration up, Veil Exposure +5 (prompted on the HUD).
- **Recipes can be taught by lore** (GDD §5.1) — recovering certain fragments learns a recipe outright (the non-experimentation path): e.g. the Ration Manifest teaches the Hide Vest, Yena's Inventory teaches the Composite Vest.

### Onboarding & accidental-exit guard

Now that the demo is public, first-time players get a hand:

- **How-to-Play overlay** — controls + the core loop + goal, auto-shown once on a new player's first New Game and reopenable anytime with `H` (or the title-screen "How to Play" button).
- **Getting-started checklist** — a small first-run HUD guide that ticks off as you gather, craft, eat/drink, and build; shows once, then never again (persisted).
- **Accidental-exit guard** — during an active run the page prompts before a reload/close (the only reliable catch for browser-reserved keys like Ctrl+W), and the page-cancellable shortcuts (F5, Ctrl+R/S/P) are suppressed while the pointer is locked.

### Game feel

Combat and movement now carry weight (code-side juice, no art assets):

- **Camera shake** — a brief, decaying screen-shake on landing a melee hit, taking damage (scaled by amount), a hard landing, and a Bellower's call. Magnitude is clamped so it never gets disorienting.
- **Hit marker + impact sparks** — the crosshair flashes red and a short burst of sparks pops at the point of a melee hit (a bigger burst on a kill). A blocked strike gives no false confirmation.

### Known gaps still out of scope

Larger self-contained subsystems left for their own pass (to avoid destabilising the finished build):

- **Structure integrity / weather degradation + maintenance** (GDD §6.1, §6.4) — the `integrity` field is tracked and saved but never decayed; needs a decay tick + repair loop + UI.
- **Full power model & Ion-surge blackouts** (GDD §6.3) — the node powers consumers within 5 m unconditionally; solar/battery/generator sources, watt budgets, OVERLOADED/OFFLINE status, and the third weather event are not implemented.
- **Cultivated crops** (GDD §4.3) and the **Crawler fire-resistance** adaptation branch (GDD §9.4) — both need a growth/timer or damage-type system first.
- Remaining content roster: other §6.2 modules (motion sensor, research benches, foundation/wall/roof variants), ranged weapons + consumable tools (§10.1).
- Smaller deltas: day:night runs 50:50 (spec 28:22), carry tops out at 40 kg (spec 45), `craft_time` is instant, the Spineback spawns at ground level rather than from the canopy, the Survey Log lacks dedicated map/recipe/augment tabs, and scanner pings aren't persisted to the Survey Log.

Natural next steps beyond the prototype: art/audio assets, the canonical 50-minute day (`CONFIG.time.secondsPerFullDay = 3000`), handcrafted biome geometry in place of the circular greybox regions, draw-call batching for the ~370 individual prop meshes, and multi-slot saves.
