import * as THREE from "three";
import { CONFIG } from "./config";
import {
  Biome,
  BIOME_LABEL,
  biomeAt,
  cradleFactor,
  spinewoodsFactor,
  veilSinkFactor,
  warrensFactor,
} from "./core/biomes";
import { clamp } from "./core/math";
import {
  CraftingStation,
  ItemCategory,
  ModuleType,
  WeatherType,
  type LoreFragment,
} from "./core/types";
import { getItem } from "./data/items";
import { Crafting } from "./systems/Crafting";
import { Knowledge } from "./systems/Knowledge";
import { Inventory } from "./systems/Inventory";
import { LoreSystem, TOTAL_FRAGMENTS } from "./systems/Lore";
import { MapSystem } from "./systems/MapSystem";
import { AugmentSystem } from "./systems/Augments";
import { CrashSites } from "./systems/CrashSites";
import { Narrative } from "./systems/Narrative";
import { Adaptation } from "./systems/Adaptation";
import { AudioSystem, type MusicState } from "./systems/AudioSystem";
import { Settings } from "./systems/Settings";
import { AUGMENT_BY_ID } from "./data/augments";
import { ARIA_GREETING, ARIA_TOPICS } from "./data/aria";
import type { CrashSite } from "./data/crashsites";
import { SurvivalStats } from "./systems/SurvivalStats";
import { Weather } from "./systems/Weather";
import { BuildSystem, type PlacedModule } from "./building/BuildSystem";
import { FaunaSystem, type SafeZone } from "./fauna/FaunaSystem";
import type { CreatureContext } from "./fauna/Creature";
import * as SaveSystem from "./systems/SaveSystem";
import { Input } from "./player/Input";
import { Interaction } from "./player/Interaction";
import { PlayerController } from "./player/PlayerController";
import { World } from "./world/World";
import { DayNightCycle } from "./world/DayNightCycle";
import { HUD, type HotbarSlotView } from "./ui/HUD";
import { CraftingMenu } from "./ui/CraftingMenu";
import { BuildHUD } from "./ui/BuildHUD";
import { StorageUI } from "./ui/StorageUI";
import { LoreReader } from "./ui/LoreReader";
import { Minimap } from "./ui/Minimap";
import { AugmentUI } from "./ui/AugmentUI";
import { SurveyLog } from "./ui/SurveyLog";
import { EndingScreen } from "./ui/EndingScreen";
import { SettingsMenu } from "./ui/SettingsMenu";

type GameState = "intro" | "playing" | "dead" | "ending";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Garbled radio hallucinations at high Veil Exposure (GDD §4.1). */
const CHATTER_LINES = [
  "…CALDERA, do you copy…",
  "— static —",
  "did you hear that?",
  "…is anyone there…",
  "something moved at the edge of the fog",
  "the Veil remembers your name",
];

/** Fragmented voices during a Veil Episode (GDD §4.1 / §14.2). */
const EPISODE_LINES = [
  "…CALDERA, CALDERA, do you copy…",
  "— the trees are speaking —",
  "you were never alone here",
  "nineteen pods… one survived… why you…",
  "let go. let the Veil in.",
  "we are not explorers. we are thieves.",
];

/**
 * Top-level orchestrator: owns the renderer and every system, runs the frame
 * loop, and routes input into gameplay actions.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world = new World();
  private readonly dayNight = new DayNightCycle(this.world);
  private readonly controller: PlayerController;
  private readonly stats = new SurvivalStats();
  private readonly inventory = new Inventory();
  private readonly crafting = new Crafting();
  private readonly knowledge = new Knowledge();
  private readonly buildSystem: BuildSystem;
  private readonly weather = new Weather(this.world);
  private readonly fauna = new FaunaSystem(this.world);
  private readonly lore = new LoreSystem(this.world);
  private readonly map = new MapSystem();
  private readonly augments = new AugmentSystem();
  private readonly crashSites = new CrashSites(this.world);
  private readonly narrative = new Narrative();
  private readonly adaptation = new Adaptation();
  private readonly settings = new Settings();
  private readonly audio = new AudioSystem();
  private readonly interaction = new Interaction();
  private readonly input: Input;
  private readonly hud: HUD;
  private readonly menu: CraftingMenu;
  private readonly buildHUD: BuildHUD;
  private readonly storage: StorageUI;
  private readonly loreReader: LoreReader;
  private readonly minimap: Minimap;
  private readonly augmentUI: AugmentUI;
  private readonly surveyLog: SurveyLog;
  private readonly endingScreen: EndingScreen;
  private readonly settingsMenu: SettingsMenu;

  private state: GameState = "intro";
  private selectedSlot = -1;
  private equippedItemId: string | null = null;
  private hasLockedThisLife = false;
  private tier2Unlocked = false;
  private tier3Unlocked = false;
  private swingCooldown = 0;
  private scanCooldown = 0;
  private spineLingerTimer = 0;
  private footstepTimer = 0;
  private autosaveTimer = 0;
  private lastBiome = "";
  private readonly safeZoneCache: SafeZone[] = [];
  private safeZoneVersion = -1;
  private readonly spikeKnock = new THREE.Vector3();
  private inEpisode = false;
  private episodeTimer = 0;
  private embraceTimer = 0;
  private chatterTimer = 12;
  private scanMarkers: { mesh: THREE.Mesh; ttl: number; max: number }[] = [];
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.controller = new PlayerController(window.innerWidth / window.innerHeight);
    this.controller.spawn(this.world);
    // Camera must live in the scene graph so its held-tool viewmodel renders.
    this.world.scene.add(this.controller.camera);

    this.buildSystem = new BuildSystem(this.world, this.inventory);
    this.input = new Input(canvas);
    this.hud = new HUD(uiRoot);
    this.menu = new CraftingMenu(uiRoot);
    this.menu.onCraft = (id) => this.tryCraft(id);
    this.menu.onRepair = (itemId) => this.repair(itemId);
    this.buildHUD = new BuildHUD(uiRoot);
    this.storage = new StorageUI(uiRoot);
    this.loreReader = new LoreReader(uiRoot);
    this.minimap = new Minimap(uiRoot);
    this.augmentUI = new AugmentUI(uiRoot);
    this.augmentUI.onInstall = (id) => this.installAugment(id);
    this.augmentUI.onUninstall = (id) => this.uninstallAugment(id);
    this.surveyLog = new SurveyLog(uiRoot);
    this.surveyLog.onAskAria = (id) => {
      this.narrative.ask(id);
      this.refreshSurveyLog();
    };
    this.endingScreen = new EndingScreen(uiRoot);
    this.settingsMenu = new SettingsMenu(uiRoot, this.settings);
    this.settingsMenu.onChange = () => this.applySettings();
    this.fauna.onBellow = () => {
      this.hud.toast("A Bellower's call rolls across the land…");
      this.audio.bellow();
    };
    this.fauna.onApexMeleeHit = (killed) => {
      const was = this.adaptation.apexAdapted;
      this.adaptation.recordApexMelee(killed);
      if (!was && this.adaptation.apexAdapted) {
        this.hud.toast("The Cradle-Spawn has learned your blade. It begins to adapt.");
      }
    };

    this.dayNight.update(0, this.controller.camera.position);
    this.hud.setContinueAvailable(SaveSystem.saveExists());
    this.applySettings();
    this.bindEvents(canvas);
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // --- event wiring ---------------------------------------------------------

  private bindEvents(canvas: HTMLCanvasElement): void {
    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.controller.camera.aspect = window.innerWidth / window.innerHeight;
      this.controller.camera.updateProjectionMatrix();
    });

    this.hud.introNewBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.beginRun(); });
    this.hud.introContinueBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.continueGame(); });
    this.hud.introSettingsBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.openSettings(); });
    this.hud.deathEl.addEventListener("click", () => this.respawn());
    const resume = () => {
      this.audio.ensureStarted();
      if (this.state === "playing" && !this.anyMenuOpen()) this.input.requestLock();
    };
    canvas.addEventListener("click", resume);
    // The pause overlay sits over the canvas with pointer-events:auto, so it eats
    // the click — it needs its own resume handler (the canvas one never fires).
    this.hud.pauseEl.addEventListener("click", resume);
  }

  private beginRun(): void {
    this.stats.reset();
    this.inventory.reset();
    this.buildSystem.clearAll();
    this.buildSystem.exit();
    this.buildHUD.hide();
    this.fauna.reset();
    this.weather.set(WeatherType.Clear);
    this.knowledge.reset();
    this.lore.reset();
    this.map.reset();
    this.augments.reset();
    this.crashSites.reset();
    this.narrative.reset();
    this.adaptation.reset();
    this.surveyLog.hide();
    this.tier2Unlocked = false;
    this.tier3Unlocked = false;
    this.applyAugmentEffects();
    this.clearMarkers();
    this.world.resetNodes();
    this.controller.spawn(this.world);
    this.dayNight.timeOfDay = CONFIG.time.startHour;
    this.equippedItemId = null;
    this.controller.setEquippedTool(null);
    this.selectedSlot = -1;
    this.spineLingerTimer = 0;
    this.inEpisode = false;
    this.hud.showEpisode(false);
    this.state = "playing";
    this.hasLockedThisLife = false;
    this.lastBiome = "";
    // Salvage from the crashed pod so the loop is reachable at once.
    this.inventory.add("ash_sediment", 4);
    this.inventory.add("fiber_frond", 3);
    this.hud.showIntro(false);
    this.input.requestLock();
    this.hud.toast("Salvaged from the pod: 4 Ash-sediment, 3 Fiber-frond");
  }

  private continueGame(): void {
    this.audio.ensureStarted();
    const data = SaveSystem.readSave();
    if (!data) {
      this.beginRun();
      return;
    }
    try {
      this.stats.reset();
      this.stats.health = data.stats.health;
      this.stats.stamina = data.stats.stamina;
      this.stats.hunger = data.stats.hunger;
      this.stats.hydration = data.stats.hydration;
      this.stats.warmth = data.stats.warmth ?? CONFIG.warmth.start;
      this.stats.veilExposure = data.stats.veilExposure ?? CONFIG.veil.start;
      this.fauna.reset();
      this.weather.set(WeatherType.Clear);
      this.knowledge.load(data.known ?? []);
      this.lore.load(data.lore ?? []);
      this.map.load(data.explored ?? []);
      this.augments.load(data.augments ?? []);
      this.crashSites.load(data.crashRecovered ?? []);
      this.narrative.load(data.narrative);
      this.adaptation.load(data.adaptation);
      this.tier2Unlocked = data.tier2 ?? false;
      this.tier3Unlocked = (data.tier3 ?? false) || this.narrative.cradleReached;
      this.applyAugmentEffects();
      this.clearMarkers();
      this.spineLingerTimer = 0;
      this.inEpisode = false;
      this.hud.showEpisode(false);

      this.inventory.reset();
      for (const s of data.inventory.stacks) this.inventory.stacks.push({ ...s });
      for (let i = 0; i < this.inventory.hotbar.length; i++) {
        this.inventory.hotbar[i] = data.inventory.hotbar[i] ?? null;
      }
      this.equippedItemId = data.equippedItemId;
      this.controller.setEquippedTool(this.equippedItemId);
      this.selectedSlot = data.selectedSlot;

      this.dayNight.timeOfDay = data.timeOfDay;
      this.buildSystem.load(data.modules);
      this.world.applyNodeStates(data.nodes);
      this.controller.applyPose(data.player);
    } catch (err) {
      console.error("[Veilborn] save load failed", err);
      this.hud.toast("Save was unreadable — starting a fresh run.");
      this.beginRun();
      return;
    }

    this.state = "playing";
    this.hasLockedThisLife = false;
    this.lastBiome = "";
    this.hud.showIntro(false);
    this.input.requestLock();
    this.hud.toast("Save loaded. Welcome back to Vaelun.");
  }

  private respawn(): void {
    this.stats.reset();
    this.fauna.reset();
    this.weather.set(WeatherType.Clear);
    this.inEpisode = false;
    this.hud.showEpisode(false);
    this.clearMarkers();
    this.controller.spawn(this.world);
    this.state = "playing";
    this.hasLockedThisLife = false;
    this.hud.showDeath(false);
    this.input.requestLock();
    this.hud.toast("You wake in a fresh escape pod. Vaelun waits.");
  }

  // --- main loop ------------------------------------------------------------

  private loop(now: number): void {
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = now;

    if (this.input.locked) this.hasLockedThisLife = true;
    const uiOpen = this.anyMenuOpen();
    const simulating =
      this.state === "playing" && this.input.locked && !uiOpen && !this.inEpisode;
    const pos = this.controller.position;

    // Settings can be opened from the title screen (state "intro"), so its
    // keyboard close (Esc/O/Tab) must be handled outside the "playing" gate too.
    if (this.state === "playing" || this.settingsMenu.visible) this.handleUIToggles();
    this.updateVeilEpisode(dt);

    if (simulating) {
      this.swingCooldown = Math.max(0, this.swingCooldown - dt);
      this.controller.update(dt, this.input, this.world, this.stats);
      this.dayNight.update(dt, this.controller.camera.position);
      this.weather.update(dt, this.controller.camera.position);
      this.applyBiomeFog();
      this.world.updateBiomeLights(pos.x, pos.z);

      const env = this.computeEnvRates();
      this.stats.update(dt, {
        sprinting: this.controller.isSprinting,
        warmthDeltaPerMin: env.warmth,
        veilDeltaPerMin: env.veil,
        staminaRegenMult: this.augments.staminaRegenMult(),
        underground: this.isUnderground(),
        oxygenMax: CONFIG.oxygen.max * this.augments.oxygenMaxMult(),
        decayMult: this.settings.data.decayRate,
      });
      this.updateCondensers(dt);

      // Spinewoods linger fuels the Spineback ambush trigger (GDD §9.2).
      if (biomeAt(pos.x, pos.z) === Biome.Spinewoods) this.spineLingerTimer += dt;
      else this.spineLingerTimer = 0;

      if (this.buildSystem.active) {
        this.interaction.current = null;
        this.buildSystem.update(this.controller.camera);
        this.handleBuildInputs();
        this.buildHUD.update(this.buildSystem.buildState());
      } else {
        this.interaction.update(
          this.controller.camera,
          this.world,
          this.buildSystem.interactables(),
          this.lore.interactables(),
          [...this.crashSites.interactables(), this.world.signalArrayObject],
        );
        this.handleActions();
      }

      this.fauna.adaptedApex = this.adaptation.apexAdapted;
      this.fauna.apexExhausted = this.adaptation.apexKills >= CONFIG.fauna.maxApexEncounters;
      this.fauna.update(dt, this.faunaContext(), this.safeZones());
      this.updateBaseDefense(dt);
      this.lore.update(dt);
      this.runDiscovery();
      this.updateChatter(dt);
      this.updateNarrative();
      this.updateAudio(dt);
      this.autosaveTimer = Math.max(0, this.autosaveTimer - dt);
      if (this.ownsMapper()) this.map.reveal(pos.x, pos.z, 100);
      if (this.stats.isDead) this.die();
    } else {
      this.interaction.current = null;
      this.dayNight.update(0, this.controller.camera.position);
    }

    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.updateMarkers(dt);

    if (this.state === "playing" && this.ownsMapper()) {
      this.minimap.show();
      this.minimap.render(this.map, pos.x, pos.z, this.controller.forwardYaw);
    } else {
      this.minimap.hide();
    }

    const paused =
      this.state === "playing" && !this.input.locked && !uiOpen && this.hasLockedThisLife;
    this.hud.showPause(paused);

    this.renderHud();
    this.renderer.render(this.world.scene, this.controller.camera);
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  // --- UI toggles (run whether or not the sim is active) --------------------

  private handleUIToggles(): void {
    // Esc is a universal "close the open overlay" everywhere (it reaches us
    // because each menu unlocks the pointer first, so the browser delivers it).
    const esc = this.input.wasPressed("Escape");
    if (this.menu.visible) {
      if (this.input.wasPressed("Tab") || esc) this.closeMenu();
      return;
    }
    if (this.loreReader.visible) {
      if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyE") || esc) this.closeLore();
      return;
    }
    if (this.augmentUI.visible) {
      if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyE") || esc) this.closeMedical();
      return;
    }
    if (this.storage.visible) {
      if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyE") || esc) this.closeStorage();
      return;
    }
    if (this.surveyLog.visible) {
      if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyJ") || esc) this.toggleSurveyLog();
      return;
    }
    if (this.settingsMenu.visible) {
      if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyO") || esc) this.closeSettings();
      return;
    }
    if (this.input.wasPressed("KeyO")) this.openSettings();
    if (this.input.wasPressed("KeyJ")) this.toggleSurveyLog();
    if (this.input.wasPressed("KeyB") && !this.menu.visible) this.toggleBuild();
    if (this.input.wasPressed("Tab") && !this.buildSystem.active) this.toggleMenu();
  }

  private toggleSurveyLog(): void {
    if (this.surveyLog.visible) {
      this.surveyLog.hide();
      this.input.requestLock();
    } else {
      this.refreshSurveyLog();
      this.surveyLog.open();
      this.input.exitLock();
    }
  }

  private refreshSurveyLog(): void {
    this.surveyLog.update({
      act: this.narrative.act,
      objective: this.narrative.objective,
      beats: this.narrative.beats,
      fragments: this.lore.collected(),
      foundCount: this.lore.foundCount,
      total: TOTAL_FRAGMENTS,
      seen: this.narrative.encounteredIds(),
      ariaGreeting: ARIA_GREETING,
      ariaTopics: ARIA_TOPICS.map((t) => ({
        id: t.id,
        label: t.label,
        response: t.response,
        available:
          t.minAct <= this.narrative.act &&
          (t.requiresBlackBox === undefined || this.narrative.blackBoxCount >= t.requiresBlackBox),
        asked: this.narrative.hasAsked(t.id),
      })),
    });
  }

  private anyMenuOpen(): boolean {
    return (
      this.menu.visible ||
      this.storage.visible ||
      this.loreReader.visible ||
      this.augmentUI.visible ||
      this.surveyLog.visible ||
      this.settingsMenu.visible
    );
  }

  private applySettings(): void {
    const d = this.settings.data;
    this.audio.setVolume(d.volume);
    this.audio.setMuted(d.muted);
    this.controller.setFov(d.fov);
    this.controller.setHeadBob(d.headBobbing);
    this.controller.setSprintToggle(d.sprintToggle);
    this.fauna.spawnDelayMult = this.settings.spawnDelayMult();
    document.body.classList.toggle("high-contrast", d.highContrast);
  }

  private openSettings(): void {
    this.audio.ui();
    this.settingsMenu.open();
    if (this.state === "playing") this.input.exitLock();
  }
  private closeSettings(): void {
    this.settingsMenu.hide();
    if (this.state === "playing") this.input.requestLock();
  }

  private ownsMapper(): boolean {
    return this.inventory.count("topographic_mapper") > 0;
  }

  /** GDD §8.2 Veil-Sense — standing in a Veil-dense danger zone (crystals / Sink). */
  private inVeilDangerZone(): boolean {
    const p = this.controller.position;
    if (veilSinkFactor(p.x, p.z) > 0.25) return true;
    const r2 = CONFIG.veil.crystalRadius ** 2;
    for (const l of this.world.veilLights) {
      if ((p.x - l.position.x) ** 2 + (p.z - l.position.z) ** 2 <= r2) return true;
    }
    return false;
  }

  /** GDD §11.3 compass — cardinal heading + bearing (clockwise from North) from the camera yaw. */
  private headingString(): string {
    const yawDeg = THREE.MathUtils.radToDeg(this.controller.forwardYaw);
    const bearing = (((360 - (yawDeg % 360)) % 360) + 360) % 360;
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const card = dirs[Math.round(bearing / 45) % 8];
    return `${card}  ${Math.round(bearing).toString().padStart(3, "0")}°`;
  }

  // Reused biome-fog tint anchors (avoid per-frame Color allocations).
  private readonly fogSpine = new THREE.Color(0x1e2a28);
  private readonly fogVeilSink = new THREE.Color(0x14202e);
  private readonly fogWarrens = new THREE.Color(0x140d09);
  private readonly fogCradle = new THREE.Color(0x2a1008);

  private applyBiomeFog(): void {
    const cam = this.controller.camera.position;
    const sf = spinewoodsFactor(cam.x, cam.z);
    if (sf > 0) {
      this.world.fog.density += sf * 0.006;
      this.world.fog.color.lerp(this.fogSpine, sf * 0.5);
    }
    const vs = veilSinkFactor(cam.x, cam.z);
    if (vs > 0) {
      this.world.fog.density += vs * CONFIG.veilSink.fogAdd;
      this.world.fog.color.lerp(this.fogVeilSink, vs * 0.6);
    }
    const wa = warrensFactor(cam.x, cam.z);
    if (wa > 0) {
      this.world.fog.density += wa * CONFIG.warrens.fogAdd;
      this.world.fog.color.lerp(this.fogWarrens, wa * 0.7);
    }
    const cr = cradleFactor(cam.x, cam.z);
    if (cr > 0) {
      this.world.fog.density += cr * 0.004;
      this.world.fog.color.lerp(this.fogCradle, cr * 0.55);
    }
  }

  // --- gameplay actions -----------------------------------------------------

  private handleActions(): void {
    if (this.input.wasPressed("Mouse0")) this.attack();
    if (this.input.wasPressed("KeyE")) this.interact();
    for (let i = 0; i < 6; i++) {
      if (this.input.wasPressed(`Digit${i + 1}`)) this.useHotbarSlot(i);
    }
  }

  // --- combat & environment -------------------------------------------------

  private attack(): void {
    if (this.equippedItemId === "scanner") {
      this.scan();
      return;
    }
    if (this.equippedItemId === "grapple_hook") {
      this.grapple();
      return;
    }
    if (this.swingCooldown > 0) return;
    if (!this.stats.trySpendStamina(CONFIG.combat.swingStaminaCost)) {
      this.swingCooldown = 0.3;
      return;
    }
    this.swingCooldown = CONFIG.combat.swingCooldownSec;
    this.controller.triggerSwing();
    const item = this.equippedItemId ? getItem(this.equippedItemId) : null;
    const dmg = item?.toolDamage ?? CONFIG.combat.unarmedDamage;
    const res = this.fauna.meleeHit(
      this.controller.camera.position,
      this.controller.forward(),
      CONFIG.combat.meleeRange,
      CONFIG.combat.meleeArcDot,
      dmg,
      CONFIG.combat.knockback,
    );
    if (res.hit) this.audio.hit();
    if (res.killed) {
      const gained: string[] = [];
      for (const l of res.loot) {
        const added = this.inventory.add(l.itemId, l.qty);
        if (added > 0) gained.push(`${added} ${getItem(l.itemId).name}`);
      }
      this.hud.toast(`${res.name} slain${gained.length ? " — +" + gained.join(", ") : ""}`);
    } else if (res.blocked) {
      // GDD §10.2 — a blocked swing costs more stamina than a normal one.
      this.stats.drainStamina(
        CONFIG.combat.blockedSwingStaminaCost - CONFIG.combat.swingStaminaCost,
      );
      this.hud.toast(`${res.name} blocks your strike`);
    }
    this.wearTool(CONFIG.tools.meleeWearPerHit);
  }

  /** Wear the equipped tool; unequip + toast if it breaks. */
  private wearTool(amount: number): void {
    if (!this.equippedItemId) return;
    const name = getItem(this.equippedItemId).name;
    if (this.inventory.damageDurability(this.equippedItemId, amount) === "broke") {
      this.controller.setEquippedTool(null);
      this.equippedItemId = null;
      this.hud.toast(`${name} broke`);
    }
  }

  /** GDD §11.4 — fire the grapple at whatever the player is aiming at. */
  private grapple(): void {
    if (this.controller.isGrappling) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.controller.camera);
    ray.far = CONFIG.grapple.maxRange;
    // Exclude the camera (its held viewmodel would otherwise self-hit).
    const targets = this.world.scene.children.filter((c) => c !== this.controller.camera);
    const hit = ray.intersectObjects(targets, true)[0];
    if (!hit) {
      this.hud.toast("Grapple: no anchor in range");
      return;
    }
    if (!this.stats.trySpendStamina(CONFIG.grapple.staminaCost)) {
      this.hud.toast("Too exhausted to grapple");
      return;
    }
    this.controller.grappleTo(hit.point);
  }

  /** GDD §11.2 — scan a 30m radius for material deposits, lore, and creatures. */
  private scan(): void {
    if (this.scanCooldown > 0) return;
    this.scanCooldown = CONFIG.scan.cooldownSec;
    this.audio.scan();
    const pos = this.controller.position;
    const r2 = CONFIG.scan.radius ** 2;
    const within = (x: number, z: number) => (x - pos.x) ** 2 + (z - pos.z) ** 2 <= r2;

    let deposits = 0;
    for (const n of this.world.resourceNodes) {
      if (n.remaining > 0 && within(n.mesh.position.x, n.mesh.position.z)) {
        this.addScanMarker(n.mesh.position, 0x3fe6c8); // teal — material deposit
        deposits++;
      }
    }
    let loreCount = 0;
    for (const o of this.lore.interactables()) {
      if (within(o.position.x, o.position.z)) {
        this.addScanMarker(o.position, 0xffcf6a); // amber — lore fragment
        loreCount++;
      }
    }
    let creatures = 0;
    for (const c of this.fauna.creatures) {
      if (c.alive && within(c.pos.x, c.pos.z)) {
        this.addScanMarker(c.pos, 0xff5a4d); // red — creature signature
        creatures++;
      }
    }

    const parts = [`${deposits} deposit${deposits === 1 ? "" : "s"}`];
    if (loreCount) parts.push(`${loreCount} lore`);
    if (creatures) parts.push(`${creatures} fauna`);
    this.hud.toast(`Scan: ${parts.join(", ")} detected`);

    if (this.inventory.damageDurability("scanner", CONFIG.scan.durabilityCost) === "broke") {
      this.controller.setEquippedTool(null);
      this.equippedItemId = null;
      this.hud.toast("Scanner broke");
    }
  }

  private addScanMarker(at: THREE.Vector3, color = 0x3fe6c8): void {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    mesh.position.set(at.x, at.y + 2.4, at.z);
    this.world.scene.add(mesh);
    this.scanMarkers.push({ mesh, ttl: CONFIG.scan.markerTtlSec, max: CONFIG.scan.markerTtlSec });
  }

  private updateMarkers(dt: number): void {
    for (let i = this.scanMarkers.length - 1; i >= 0; i--) {
      const m = this.scanMarkers[i];
      m.ttl -= dt;
      m.mesh.rotation.y += dt * 2.2;
      m.mesh.position.y += dt * 0.25;
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, m.ttl / m.max) * 0.9;
      if (m.ttl <= 0) {
        this.world.scene.remove(m.mesh);
        m.mesh.geometry.dispose();
        (m.mesh.material as THREE.Material).dispose();
        this.scanMarkers.splice(i, 1);
      }
    }
  }

  private clearMarkers(): void {
    for (const m of this.scanMarkers) {
      this.world.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.Material).dispose();
    }
    this.scanMarkers.length = 0;
  }

  private hasFabricator(): boolean {
    return this.buildSystem.placed.some((m) => m.type === ModuleType.Fabricator);
  }

  private runDiscovery(): void {
    const found = this.knowledge.discover(this.inventory, {
      hasFabricator: this.hasFabricator(),
      hasTier2: this.tier2Unlocked,
      hasTier3: this.tier3Unlocked,
    });
    for (const name of found) this.hud.toast(`Recipe discovered: ${name}`);
  }

  /**
   * GDD §4 oxygen — only the enclosed Crust Warrens pit is truly "underground".
   * Phase 12 fix: the depth threshold alone also caught the open Veil Sink bowl
   * (its floor dips to ~-11, below -9), which wrongly suffocated the player there
   * and suppressed the Sink's cold/wet warmth drain. Gate on the Warrens region.
   */
  private isUnderground(): boolean {
    const p = this.controller.position;
    return p.y < CONFIG.oxygen.depthThreshold && warrensFactor(p.x, p.z) > 0.5;
  }

  /** Net warmth & Veil-exposure rates (per minute) for this frame. */
  private computeEnvRates(): { warmth: number; veil: number } {
    const pos = this.controller.position;
    const w = CONFIG.warmth;
    const v = CONFIG.veil;
    const nearFire = this.nearAnyFire(pos.x, pos.z);

    const sink = veilSinkFactor(pos.x, pos.z);
    const underground = this.isUnderground();

    // Warmth: the Warrens are warm (no drain, GDD §4.4). Elsewhere, drain from
    // night + storm + the cold, wet Veil Sink, reduced by Thermal Skin (A03).
    let drain = 0;
    if (!underground) {
      // GDD §4.4 — an Ashstorm is a cold-snap *override* of the ambient day/night
      // drain (not additive); the Veil Sink's cold/wet still stacks on top.
      if (this.weather.current === WeatherType.Ashstorm) {
        drain = w.ashstormDrainPerMin * this.weather.intensity;
      } else if (this.dayNight.isNight) {
        drain = w.nightDrainPerMin;
      }
      drain += CONFIG.veilSink.warmthDrainPerMin * sink;
      drain *= this.augments.warmthDrainMult();
    }
    let warmth = -drain;
    if (nearFire) warmth += w.fireWarmPerMin;

    const nearCrystal = this.world.veilLights.some(
      (l) => (pos.x - l.position.x) ** 2 + (pos.z - l.position.z) ** 2 <= v.crystalRadius ** 2,
    );
    let rise = 0;
    if (nearCrystal) rise += v.crystalRisePerMin;
    if (this.weather.current === WeatherType.VeilRain && !nearFire) {
      rise += v.veilRainRisePerMin * this.weather.intensity;
    }
    if (this.dayNight.isNight) rise += v.nightRisePerMin;
    rise += CONFIG.veilSink.veilRisePerMin * sink; // dense Veil-matter
    rise *= this.augments.veilRiseMult() * this.settings.data.veilRate; // A07 + difficulty
    const veil = rise - v.decayPerMin - (nearFire ? v.shelterDecayPerMin : 0);
    return { warmth, veil };
  }

  /** True if (x,z) is within fire-warmth radius of any placed Fire Pit. */
  private nearAnyFire(x: number, z: number): boolean {
    const r2 = CONFIG.warmth.fireRadius ** 2;
    const fires = this.buildSystem.firePositions; // cached array
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      if ((x - f.x) ** 2 + (z - f.z) ** 2 <= r2) return true;
    }
    return false;
  }

  private safeZones(): SafeZone[] {
    // Rebuilt only when the base changes (fauna reads this every frame).
    if (this.safeZoneVersion !== this.buildSystem.structureVersion) {
      this.safeZoneVersion = this.buildSystem.structureVersion;
      const zones = this.safeZoneCache;
      zones.length = 0;
      for (const f of this.buildSystem.firePositions) {
        zones.push({ x: f.x, z: f.z, r: CONFIG.fauna.safeRadius });
      }
      zones.push({ x: 0, z: 0, r: CONFIG.fauna.safeRadius }); // the spawn pod
    }
    return this.safeZoneCache;
  }

  /** GDD §6.2 Perimeter Spike — chip nearby (non-apex) fauna each frame. */
  private updateBaseDefense(dt: number): void {
    const spikes = this.buildSystem.spikePositions;
    if (spikes.length === 0) return;
    const r2 = CONFIG.defense.spikeRadius ** 2;
    const dmg = CONFIG.defense.spikeDamagePerSec * dt;
    for (const c of this.fauna.creatures) {
      if (!c.alive || c.def.isApex) continue; // apex are not cheesed by spikes
      for (let i = 0; i < spikes.length; i++) {
        const dx = c.pos.x - spikes[i].x;
        const dz = c.pos.z - spikes[i].z;
        if (dx * dx + dz * dz <= r2) {
          this.spikeKnock.set(dx, 0, dz).normalize();
          c.takeDamage(dmg, this.spikeKnock, 0.04);
          break; // one spike's worth of damage per creature per frame
        }
      }
    }
  }

  private faunaContext(): CreatureContext {
    return {
      playerPos: this.controller.position,
      playerCrouching: this.controller.isCrouching,
      playerVeil: this.stats.veilExposure,
      isNight: this.dayNight.isNight,
      world: this.world,
      lingerAmbush: this.spineLingerTimer > 120,
      apexAdapted: this.adaptation.apexAdapted,
      passive: this.settings.passive,
      damagePlayer: (amount: number) => {
        this.stats.damage(amount * this.augments.damageTakenMult() * this.settings.damageMult());
        this.hud.flashDamage();
        this.audio.hurt();
      },
    };
  }

  private collectLore(fragment: LoreFragment): void {
    if (this.lore.isFound(fragment.id)) return;
    this.lore.collect(fragment);
    this.audio.pickup();
    this.loreReader.show(fragment, this.lore.foundCount, TOTAL_FRAGMENTS);
    this.input.exitLock();
    this.hud.toast(`Lore fragment recovered (${this.lore.foundCount}/${TOTAL_FRAGMENTS})`);
    this.autoSave();
    if (fragment.blackBox) {
      const prevAct = this.narrative.act;
      this.narrative.blackBoxCount = this.lore.blackBoxFound();
      this.narrative.pushBeat(`Black box recovered — ${fragment.title}`);
      if (this.narrative.act > prevAct) {
        this.narrative.pushBeat("The annex is clearer now: CALDERA came to take, not to learn.");
        this.hud.toast("Act 2 — the black boxes speak");
      }
    }
  }

  /** Signal Tracer bearing to the nearest black box (or the Cradle array). */
  private computeTracer(): { bearing: number; dist: number; label: string } | null {
    if (this.inventory.count("signal_tracer") <= 0) return null;
    const p = this.controller.position;
    let tx: number, tz: number, label: string;
    const ub = this.lore.uncollectedBlackBox();
    if (ub.length) {
      let best = ub[0];
      let bd = Infinity;
      for (const f of ub) {
        const d = (f.x - p.x) ** 2 + (f.z - p.z) ** 2;
        if (d < bd) { bd = d; best = f; }
      }
      tx = best.x; tz = best.z; label = "Black box";
    } else {
      tx = this.world.cradleSignalPos.x; tz = this.world.cradleSignalPos.z; label = "Signal Array";
    }
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    const yaw = this.controller.forwardYaw;
    const fdot = (dx / dist) * -Math.sin(yaw) + (dz / dist) * -Math.cos(yaw);
    const rdot = (dx / dist) * Math.cos(yaw) + (dz / dist) * -Math.sin(yaw);
    return { bearing: Math.atan2(rdot, fdot), dist, label };
  }

  // --- Phase 10: endings ----------------------------------------------------

  private attemptRepair(): void {
    const cost = CONFIG.endings.repairCost;
    if (!cost.every((c) => this.inventory.has(c.itemId, c.quantity))) {
      const need = cost.map((c) => `${c.quantity} ${getItem(c.itemId).name}`).join(", ");
      this.hud.toast(`Signal Array needs: ${need}`);
      return;
    }
    for (const c of cost) this.inventory.remove(c.itemId, c.quantity);
    this.hud.toast("Signal array repaired — broadcasting…");
    this.triggerEnding("escape");
  }

  private triggerEnding(kind: "escape" | "integration"): void {
    this.inEpisode = false;
    this.hud.showEpisode(false);
    this.surveyLog.hide();
    this.state = "ending";
    this.input.exitLock();
    const allFragments = this.lore.foundCount >= TOTAL_FRAGMENTS;
    this.endingScreen.show(kind, allFragments, () => {
      this.state = "intro";
      this.hud.showIntro(true);
      this.hud.setContinueAvailable(SaveSystem.saveExists());
    });
  }

  private updateNarrative(): void {
    const p = this.controller.position;
    if (!this.narrative.cradleReached && biomeAt(p.x, p.z) === Biome.Cradle) {
      this.narrative.cradleReached = true;
      this.tier3Unlocked = true; // GDD §5.2 — Tier 3 fabrication unlocks at the Cradle
      this.narrative.pushBeat("You stand in the Cradle's red shadow. The planet turns to face you.");
      this.hud.toast("The Cradle — Act 3 begins");
      this.hud.toast("Tier 3 fabrication unlocked — Veil-forged recipes available");
    }
    for (const c of this.fauna.creatures) {
      if (c.alive && c.isAggressive && this.narrative.encounter(c.def.id)) {
        this.hud.toast(`Catalogued: ${c.def.name}`);
      }
    }

    // Autosave when crossing a biome threshold (GDD §17 Phase 11 — quiet saves).
    const biome = BIOME_LABEL[biomeAt(p.x, p.z)];
    if (this.lastBiome && this.lastBiome !== biome) this.autoSave();
    this.lastBiome = biome;
  }

  private closeLore(): void {
    this.loreReader.hide();
    this.input.requestLock();
  }

  // --- Phase 6: augments, crash sites, condenser ---------------------------

  private salvageCrash(site: CrashSite): void {
    if (this.crashSites.isRecovered(site.id)) return;
    const gained: string[] = [];
    for (const l of site.loot) {
      const added = this.inventory.add(l.itemId, l.qty);
      if (added > 0) gained.push(`${added} ${getItem(l.itemId).name}`);
    }
    if (this.inventory.add(site.augmentItemId, 1) > 0) {
      gained.push(getItem(site.augmentItemId).name);
    }
    this.crashSites.recover(site);
    if (!this.tier2Unlocked) {
      this.tier2Unlocked = true;
      this.hud.toast("Ship Component recovered — Tier-2 fabrication unlocked");
    }
    this.hud.toast(`Salvaged: ${gained.join(", ")}`);
  }

  private openMedical(module: PlacedModule): void {
    if (!module.powered) {
      this.hud.toast("Medical Station needs power — place a Power Node within 5m");
      return;
    }
    this.augmentUI.open();
    this.augmentUI.update(this.inventory, this.augments);
    this.input.exitLock();
  }

  private closeMedical(): void {
    this.augmentUI.hide();
    this.input.requestLock();
  }

  private installAugment(augId: string): void {
    const def = AUGMENT_BY_ID[augId];
    if (!def || !this.inventory.has(def.itemId, 1)) return;
    if (!this.augments.install(augId)) {
      this.hud.toast("Cannot install — not enough augment slots");
      return;
    }
    this.inventory.remove(def.itemId, 1);
    this.applyAugmentEffects();
    this.hud.toast(`Installed ${def.name}`);
    this.augmentUI.update(this.inventory, this.augments);
  }

  private uninstallAugment(augId: string): void {
    const def = AUGMENT_BY_ID[augId];
    if (!def || !this.augments.uninstall(augId)) return;
    this.inventory.add(def.itemId, 1); // returns the augment item
    this.applyAugmentEffects();
    this.hud.toast(`Removed ${def.name}`);
    this.augmentUI.update(this.inventory, this.augments);
  }

  /** Push augment effects that live outside the per-frame getters. */
  private applyAugmentEffects(): void {
    this.inventory.bonusWeight = this.augments.carryBonus();
  }

  private updateCondensers(dt: number): void {
    const c = CONFIG.condenser;
    for (const m of this.buildSystem.placed) {
      if (m.type !== ModuleType.Condenser || m.water === undefined) continue;
      if (m.powered) m.water = Math.min(c.max, m.water + (c.ratePerMin / 60) * dt);
    }
  }

  // --- Phase 7: Veil Episode + hallucinations -------------------------------

  private updateVeilEpisode(dt: number): void {
    if (this.inEpisode) {
      this.episodeTimer -= dt;
      // Hold F to embrace the Veil — Ending B (GDD §12.1).
      if (this.input.isDown("KeyF")) {
        this.embraceTimer += dt;
        if (this.embraceTimer >= CONFIG.endings.embraceHoldSec) {
          this.triggerEnding("integration");
          return;
        }
      } else {
        this.embraceTimer = 0;
      }
      const idx =
        Math.floor((CONFIG.veil.episodeDurationSec - this.episodeTimer) / 1.2) %
        EPISODE_LINES.length;
      this.hud.setEpisodeText(EPISODE_LINES[idx]);
      if (this.episodeTimer <= 0) {
        this.inEpisode = false;
        this.stats.veilExposure = CONFIG.veil.episodePurgeTo;
        this.hud.showEpisode(false);
        this.hud.toast("The Veil recedes. You surface, changed.");
      }
      return;
    }
    if (this.state === "playing" && this.stats.veilExposure >= 100) {
      this.inEpisode = true;
      this.episodeTimer = CONFIG.veil.episodeDurationSec;
      this.embraceTimer = 0;
      this.hud.showEpisode(true);
    }
  }

  private updateAudio(dt: number): void {
    const pos = this.controller.position;
    let nearest = Infinity;
    for (const c of this.fauna.creatures) {
      if (c.alive) nearest = Math.min(nearest, c.pos.distanceTo(pos));
    }
    const nearFire =
      this.nearAnyFire(pos.x, pos.z) || Math.hypot(pos.x, pos.z) < CONFIG.fauna.safeRadius;
    let state: MusicState;
    if (this.inEpisode) state = "episode";
    else if (this.fauna.aggroCount > 0 && nearest < 7) state = "combat";
    else if (nearest < 30) state = "threat";
    else if (nearFire) state = "calm";
    else state = "explore";
    this.audio.setMusic(state, this.dayNight.isNight);

    if (this.controller.isMoving) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.audio.footstep();
        this.footstepTimer = this.controller.isSprinting ? 0.32 : 0.5;
      }
    } else {
      this.footstepTimer = 0;
    }
  }

  private autoSave(): void {
    if (this.state !== "playing" || this.autosaveTimer > 0) return;
    this.autosaveTimer = 2;
    this.saveGame();
    this.hud.showSaved();
  }

  private updateChatter(dt: number): void {
    if (!this.settings.data.subtitles) return;
    if (this.stats.veilExposure < CONFIG.veil.hallucinateStart) {
      this.chatterTimer = 12;
      return;
    }
    this.chatterTimer -= dt;
    if (this.chatterTimer <= 0) {
      this.hud.toast(CHATTER_LINES[Math.floor(Math.random() * CHATTER_LINES.length)]);
      this.chatterTimer =
        CONFIG.veil.chatterMinSec + Math.random() * (CONFIG.veil.chatterMaxSec - CONFIG.veil.chatterMinSec);
    }
  }

  /** GDD §4.3 — cook raw Spore-caps at a fire into the safe, higher-nutrition form. */
  private cookFood(): void {
    const raw = this.inventory.count("spore_cap");
    if (raw <= 0) {
      this.hud.toast("Nothing to cook — gather Spore-caps first");
      return;
    }
    this.inventory.remove("spore_cap", raw);
    const added = this.inventory.add("cooked_spore_cap", raw);
    this.audio.craft();
    this.hud.toast(`Cooked ${added} Spore-cap${added === 1 ? "" : "s"}`);
  }

  private drinkCondenser(module: PlacedModule): void {
    const c = CONFIG.condenser;
    if (!module.powered) {
      this.hud.toast("Condenser needs power — place a Power Node within 5m");
      return;
    }
    if ((module.water ?? 0) < c.drinkUnits) {
      this.hud.toast(`Condenser still collecting (${Math.floor(module.water ?? 0)}/${c.max})`);
      return;
    }
    module.water = (module.water ?? 0) - c.drinkUnits;
    this.stats.drink(c.drinkHydration);
    this.hud.toast(`Drank condensate — hydration +${c.drinkHydration}`);
  }

  private handleBuildInputs(): void {
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) this.buildSystem.cycle(wheel);
    if (this.input.wasPressed("KeyQ")) this.buildSystem.cycle(-1);
    if (this.input.wasPressed("KeyE")) this.buildSystem.cycle(1);
    if (this.input.wasPressed("KeyR")) this.buildSystem.rotate();
    if (this.input.wasPressed("Mouse0")) {
      const res = this.buildSystem.place();
      if (res.ok) {
        this.audio.craft();
        const msg =
          res.def.type === ModuleType.PowerNode
            ? `Power Node online — ${res.poweredCount} module(s) powered`
            : `Built ${res.def.name}`;
        this.hud.toast(msg);
        this.autoSave();
      } else {
        this.hud.toast(res.reason);
      }
    }
  }

  private interact(): void {
    const t = this.interaction.current;
    if (!t) return;

    if (t.kind === "module") {
      const kind = t.module.def.interact;
      if (kind === "sleep") this.sleepAndSave();
      else if (kind === "storage") this.openStorage(t.module);
      else if (kind === "fabricator") this.openFabricator();
      else if (kind === "medical") this.openMedical(t.module);
      else if (kind === "condenser") this.drinkCondenser(t.module);
      else if (kind === "cook") this.cookFood();
      return;
    }

    if (t.kind === "lore") {
      this.collectLore(t.fragment);
      return;
    }

    if (t.kind === "crash") {
      this.salvageCrash(t.site);
      return;
    }

    if (t.kind === "signal") {
      this.attemptRepair();
      return;
    }

    const node = t.node;
    if (node.kind === "water") {
      this.stats.drink(node.drinkAmount);
      this.hud.toast(`Drank from ${node.label} — hydration +${node.drinkAmount}`);
      return;
    }
    if (node.kind === "bio" && !this.dayNight.isNight) {
      this.hud.toast("Bioluminite is dormant — gather it at night");
      return;
    }
    const qty = randInt(node.yieldMin, node.yieldMax);
    const added = this.inventory.add(node.yieldItemId!, qty);
    if (added <= 0) {
      this.hud.toast("Inventory full — over carry weight");
      return;
    }
    this.hud.toast(`+${added} ${node.label}${added < qty ? " (carry full)" : ""}`);
    this.audio.gather();
    // Harvesting wears a held harvesting/weapon tool (GDD §10.3).
    if (this.equippedItemId && getItem(this.equippedItemId).toolDamage) {
      this.wearTool(CONFIG.tools.gatherWearPerHit);
    }
    node.remaining -= 1;
    if (node.remaining <= 0) {
      this.world.depleteNode(node);
      this.interaction.current = null;
    }
  }

  private useHotbarSlot(i: number): void {
    const itemId = this.inventory.hotbar[i];
    if (!itemId) return;
    const item = getItem(itemId);
    this.selectedSlot = i;

    switch (item.category) {
      case ItemCategory.Tool: {
        if (this.equippedItemId === itemId) {
          this.equippedItemId = null;
          this.controller.setEquippedTool(null);
          this.hud.toast(`${item.name} stowed`);
        } else {
          this.equippedItemId = itemId;
          this.controller.setEquippedTool(itemId);
          this.hud.toast(`${item.name} equipped`);
        }
        break;
      }
      case ItemCategory.Consumable: {
        const use = item.use;
        if (use?.kind === "eat") {
          this.stats.eat(use.hunger);
          this.hud.toast(`Ate ${item.name} — hunger +${use.hunger}`);
          // GDD §4.3: raw food can cause Gut-rot, negated by Iron Gut (A01).
          if (itemId === "spore_cap" && !this.augments.hasIronGut() && Math.random() < 0.3) {
            this.stats.eat(-12);
            this.stats.damage(4);
            this.hud.toast("Gut-rot! The raw spore-cap turns your stomach");
          }
        } else if (use?.kind === "drink") {
          this.stats.drink(use.hydration);
          this.hud.toast(`Drank ${item.name} — hydration +${use.hydration}`);
        } else if (use?.kind === "purge") {
          this.stats.veilExposure = Math.max(0, this.stats.veilExposure - use.veil);
          this.hud.toast(`${item.name} — Veil Exposure -${use.veil}`);
        } else if (use?.kind === "heal") {
          this.stats.heal(use.health);
          this.hud.toast(`Used ${item.name} — health +${use.health}`);
        }
        this.inventory.remove(itemId, 1);
        break;
      }
      case ItemCategory.Placeable: {
        const yaw = this.controller.forwardYaw;
        const px = this.controller.position.x + -Math.sin(yaw) * 2.4;
        const pz = this.controller.position.z + -Math.cos(yaw) * 2.4;
        this.world.placeShelter(px, pz, yaw);
        this.inventory.remove(itemId, 1);
        this.hud.toast(`${item.name} deployed`);
        break;
      }
      default:
        break;
    }
  }

  // --- base building & modules ---------------------------------------------

  private toggleBuild(): void {
    const active = this.buildSystem.toggle();
    if (active) {
      this.buildHUD.show();
      this.buildHUD.update(this.buildSystem.buildState());
    } else {
      this.buildHUD.hide();
    }
  }

  private sleepAndSave(): void {
    this.dayNight.timeOfDay = 6.0; // wake at dawn
    this.stats.stamina = 100;
    this.stats.heal(20);
    this.saveGame();
    this.hud.showSaved();
    this.hud.toast("Rested until dawn. Game saved.");
  }

  private openStorage(module: PlacedModule): void {
    if (!module.storage) return;
    this.storage.open(this.inventory, module.storage);
    this.input.exitLock();
  }

  private closeStorage(): void {
    this.storage.close();
    this.input.requestLock();
  }

  private saveGame(): void {
    const ok = SaveSystem.writeSave({
      timeOfDay: this.dayNight.timeOfDay,
      player: this.controller.getPose(),
      stats: {
        health: this.stats.health,
        stamina: this.stats.stamina,
        hunger: this.stats.hunger,
        hydration: this.stats.hydration,
        warmth: this.stats.warmth,
        veilExposure: this.stats.veilExposure,
      },
      inventory: {
        stacks: this.inventory.stacks.map((s) => ({ ...s })),
        hotbar: this.inventory.hotbar.slice(),
      },
      equippedItemId: this.equippedItemId,
      selectedSlot: this.selectedSlot,
      known: this.knowledge.serialize(),
      lore: this.lore.serialize(),
      explored: this.map.serialize(),
      augments: this.augments.serialize(),
      crashRecovered: this.crashSites.serialize(),
      tier2: this.tier2Unlocked,
      tier3: this.tier3Unlocked,
      narrative: this.narrative.serialize(),
      adaptation: this.adaptation.serialize(),
      modules: this.buildSystem.serialize(),
      nodes: this.world.nodeStates(),
    });
    if (ok) this.hud.setContinueAvailable(true);
  }

  // --- crafting / menus -----------------------------------------------------

  private tryCraft(recipeId: string): void {
    const recipe = this.crafting.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const result = this.crafting.craft(recipe, this.inventory);
    if (result.ok) {
      this.audio.craft();
      this.hud.toast(`Crafted ${recipe.name}`);
    } else if (result.reason === "no_space") this.hud.toast("Too heavy to craft that");
    else this.hud.toast("Missing materials");
    this.runDiscovery();
    this.menu.update(this.inventory, this.crafting, this.knowledge);
  }

  private repair(itemId: string): void {
    const recipe = this.crafting.recipeForOutput(itemId);
    if (!recipe) return;
    if (!recipe.ingredients.every((ing) => this.inventory.has(ing.itemId, ing.quantity))) {
      this.hud.toast("Missing repair materials");
      return;
    }
    for (const ing of recipe.ingredients) this.inventory.remove(ing.itemId, ing.quantity);
    this.inventory.repairTool(itemId, CONFIG.tools.repairAmount);
    this.hud.toast(`Repaired ${getItem(itemId).name} (+${CONFIG.tools.repairAmount})`);
    this.menu.update(this.inventory, this.crafting, this.knowledge);
  }

  private toggleMenu(): void {
    if (this.menu.visible) this.closeMenu();
    else this.openMenu(CraftingStation.Hand);
  }

  private openFabricator(): void {
    this.openMenu(CraftingStation.Fabricator);
  }

  private openMenu(station: CraftingStation): void {
    this.audio.ui();
    this.menu.open(station);
    this.input.exitLock();
    this.menu.update(this.inventory, this.crafting, this.knowledge);
  }

  private closeMenu(): void {
    this.menu.hide();
    this.input.requestLock();
  }

  private die(): void {
    this.state = "dead";
    this.buildSystem.exit();
    this.buildHUD.hide();
    this.input.exitLock();
    this.hud.showDeath(true);
  }

  // --- HUD assembly ---------------------------------------------------------

  private renderHud(): void {
    const t = this.buildSystem.active ? null : this.interaction.current;

    let toolName: string | null = null;
    let toolDurability: number | null = null;
    if (this.equippedItemId) {
      const item = getItem(this.equippedItemId);
      const stack = this.inventory.getStack(this.equippedItemId);
      if (item.maxDurability !== undefined && stack?.durability !== undefined) {
        toolName = item.name;
        toolDurability = stack.durability / item.maxDurability;
      }
    }
    const hotbar: HotbarSlotView[] = this.inventory.hotbar.map((id, i) => {
      if (!id) return { empty: true, name: "", qty: 0, kind: "", selected: false };
      const item = getItem(id);
      return {
        empty: false,
        name: item.name,
        qty: this.inventory.count(id),
        kind: item.category.toLowerCase(),
        selected: i === this.selectedSlot,
      };
    });

    this.hud.update({
      health: this.stats.health,
      stamina: this.stats.stamina,
      hunger: this.stats.hunger,
      hydration: this.stats.hydration,
      warmth: this.stats.warmth,
      veilExposure: this.stats.veilExposure,
      oxygen: this.stats.oxygen,
      oxygenMax: CONFIG.oxygen.max * this.augments.oxygenMaxMult(),
      showOxygen:
        this.isUnderground() ||
        this.stats.oxygen < CONFIG.oxygen.max * this.augments.oxygenMaxMult() - 0.5,
      isSprinting: this.controller.isSprinting,
      clock: this.dayNight.clockString,
      isNight: this.dayNight.isNight,
      weather: this.weather.current === WeatherType.Clear ? null : this.weather.label,
      threat: this.fauna.aggroCount,
      biome: BIOME_LABEL[biomeAt(this.controller.position.x, this.controller.position.z)],
      veilSense: this.augments.hasVeilSense(),
      veilDanger: this.augments.hasVeilSense() && this.inVeilDangerZone(),
      compass: this.settings.data.compass ? this.headingString() : null,
      tracer: this.computeTracer(),
      prompt: t ? `<span class="key">[E]</span> ${t.verb} ${t.label}` : null,
      lookingAtNode: !!t,
      hotbar,
      toolName,
      toolDurability,
      minimalHud: !this.settings.data.alwaysShowStats,
    });
  }
}
