import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
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
  type DamageType,
  type ItemDef,
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
import { Equipment } from "./systems/Equipment";
import { AudioSystem, type MusicState } from "./systems/AudioSystem";
import { Settings } from "./systems/Settings";
import { AUGMENT_BY_ID, AUGMENTS } from "./data/augments";
import { ARIA_GREETING, ARIA_TOPICS } from "./data/aria";
import type { CrashSite } from "./data/crashsites";
import { SurvivalStats } from "./systems/SurvivalStats";
import { Weather } from "./systems/Weather";
import { BuildSystem, type PlacedModule } from "./building/BuildSystem";
import { FaunaSystem, type MeleeResult, type SafeZone } from "./fauna/FaunaSystem";
import { Effects } from "./systems/Effects";
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
import { HelpScreen } from "./ui/HelpScreen";
import { Onboarding } from "./systems/Onboarding";

type GameState = "intro" | "playing" | "dead" | "ending";

/** Shared geometry for impact sparks (one instance, reused by every particle). */
const IMPACT_GEO = new THREE.OctahedronGeometry(0.09, 0);

/**
 * Multiplicative vignette — darkens the corners RELATIVE to the scene (so dark
 * night scenes stay proportional instead of being crushed to pure black, which
 * three's stock additive VignetteShader does). Centre is always untouched.
 */
const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.4 },
    radius: { value: 0.7 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float radius;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float dist = length(vUv - 0.5) * 1.41421356;
      float v = smoothstep(radius, 1.0, dist);
      c.rgb *= (1.0 - v * strength);
      gl_FragColor = c;
    }`,
};

/**
 * Volumetric light scattering ("god-rays") — radially smears bright pixels (the
 * sun disc + bloomed Veil-matter) outward from the sun's screen position into
 * light shafts. Additive, in linear space; `exposure` is gated to 0 by the Game
 * when the sun is below the horizon or behind the camera (then it's a no-op).
 */
const GODRAYS_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    lightPos: { value: new THREE.Vector2(0.5, 0.5) },
    exposure: { value: 0.0 },
    decay: { value: 0.95 },
    density: { value: 0.8 },
    weight: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 lightPos;
    uniform float exposure;
    uniform float decay;
    uniform float density;
    uniform float weight;
    varying vec2 vUv;
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      if (exposure <= 0.001) { gl_FragColor = vec4(base, 1.0); return; }
      const int SAMPLES = 50;
      vec2 dtc = (vUv - lightPos) * (density / float(SAMPLES));
      vec2 tc = vUv;
      float illum = 1.0;
      vec3 rays = vec3(0.0);
      for (int i = 0; i < SAMPLES; i++) {
        tc -= dtc;
        vec3 s = texture2D(tDiffuse, tc).rgb;
        float lum = max(max(s.r, s.g), s.b);
        s *= smoothstep(0.7, 1.1, lum); // only bright pixels cast shafts
        rays += s * illum * weight;
        illum *= decay;
      }
      gl_FragColor = vec4(base + rays * exposure, 1.0);
    }`,
};

/** Final colour grade (display space): subtle contrast, saturation, and a warm tint. */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.06 },
    saturation: { value: 1.12 },
    tint: { value: new THREE.Color(1.0, 0.99, 0.96) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 tint;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = (c.rgb - 0.5) * contrast + 0.5;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, saturation);
      col *= tint;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

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
  private composer: EffectComposer | null = null;
  private godrays: ShaderPass | null = null;
  private readonly tmpSunDir = new THREE.Vector3();
  private readonly tmpCamDir = new THREE.Vector3();
  private readonly tmpSunProj = new THREE.Vector3();
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
  private readonly equipment = new Equipment();
  private readonly effects = new Effects();
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
  private readonly helpScreen: HelpScreen;
  private readonly onboarding = new Onboarding();

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
  private lightningTimer = 2; // next Ion-surge strike countdown
  private caveInTimer = 60; // next Warrens cave-in countdown (only ticks underground)
  private caveInWarn = -1; // >=0 while the roof is groaning (telegraph)
  private sensorCooldown = 0; // motion-sensor ping cooldown
  /** GDD §11.2 — the last scanner sweep, logged into the Survey Log Tech tab. */
  private lastScan: {
    clock: string;
    biome: string;
    deposits: number;
    lore: number;
    fauna: number;
  } | null = null;
  private readonly safeZoneCache: SafeZone[] = [];
  private safeZoneVersion = -1;
  private readonly spikeKnock = new THREE.Vector3();
  private inEpisode = false;
  private episodeTimer = 0;
  private embraceTimer = 0;
  private chatterTimer = 12;
  private scanMarkers: { mesh: THREE.Mesh; ttl: number; max: number }[] = [];
  private impacts: { mesh: THREE.Mesh; vel: THREE.Vector3; ttl: number; max: number }[] = [];
  /** GDD §10.1 deployed gadgets (flares repel fauna; decoys lure them). */
  private deployables: {
    kind: "flare" | "decoy";
    mesh: THREE.Group;
    light: THREE.PointLight | null;
    ttl: number;
    pos: THREE.Vector3;
  }[] = [];
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

    // --- Post-processing: bloom on the Veil-matter glow + a subtle vignette.
    // OutputPass applies the renderer's ACES tone mapping, so the palette holds. ---
    try {
      const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const fx = CONFIG.postfx;
      this.composer = new EffectComposer(this.renderer);
      this.composer.setSize(sz.x, sz.y);
      this.composer.addPass(new RenderPass(this.world.scene, this.controller.camera));
      this.composer.addPass(
        new UnrealBloomPass(sz.clone(), fx.bloomStrength, fx.bloomRadius, fx.bloomThreshold),
      );
      this.godrays = new ShaderPass(GODRAYS_SHADER);
      this.godrays.uniforms.decay.value = fx.godrayDecay;
      this.godrays.uniforms.density.value = fx.godrayDensity;
      this.godrays.uniforms.weight.value = fx.godrayWeight;
      this.composer.addPass(this.godrays);
      const vignette = new ShaderPass(VIGNETTE_SHADER);
      vignette.uniforms.strength.value = fx.vignetteStrength;
      vignette.uniforms.radius.value = fx.vignetteRadius;
      this.composer.addPass(vignette);
      this.composer.addPass(new OutputPass());
      const grade = new ShaderPass(GRADE_SHADER);
      grade.uniforms.contrast.value = fx.gradeContrast;
      grade.uniforms.saturation.value = fx.gradeSaturation;
      this.composer.addPass(grade);
    } catch (e) {
      console.error("[Veilborn] post-processing init failed; using direct render", e);
      this.composer = null;
    }

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
    this.helpScreen = new HelpScreen(uiRoot);
    this.helpScreen.onClose = () => this.closeHelp();
    this.fauna.onBellow = () => {
      this.hud.toast("A Bellower's call rolls across the land…");
      this.audio.bellow();
      this.controller.addShake(CONFIG.feel.bellowShake);
    };
    this.buildSystem.onCollapse = (name) => {
      this.hud.toast(`${name} collapses under the storm!`);
      this.audio.hurt();
      this.controller.addShake(0.12);
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
      if (this.composer) {
        const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        this.composer.setSize(sz.x, sz.y);
      }
    });

    this.hud.introNewBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.beginRun(); });
    this.hud.introContinueBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.continueGame(); });
    this.hud.introSettingsBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.openSettings(); });
    this.hud.introHelpBtn.addEventListener("click", () => { this.audio.ensureStarted(); this.openHelp(); });
    this.hud.deathEl.addEventListener("click", () => this.respawn());
    const resume = () => {
      this.audio.ensureStarted();
      if (this.state === "playing" && !this.anyMenuOpen()) this.input.requestLock();
    };
    canvas.addEventListener("click", resume);
    // The pause overlay sits over the canvas with pointer-events:auto, so it eats
    // the click — it needs its own resume handler (the canvas one never fires).
    this.hud.pauseEl.addEventListener("click", resume);
    // Guard against an accidental reload/close/navigate ending a run silently —
    // the only reliable catch for browser-reserved keys (Ctrl+W/R, F5). Only
    // prompts mid-run, never on the title or ending screens.
    window.addEventListener("beforeunload", (e) => {
      if (this.state === "playing" || this.state === "dead") {
        e.preventDefault();
        e.returnValue = "";
      }
    });
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
    this.effects.reset();
    this.lastScan = null;
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
    this.equipment.refresh(this.inventory);
    this.hud.showIntro(false);
    // First-time player: show the How-to-Play overlay and start the getting-started
    // guide; play begins when they close help. Returning players lock in directly.
    if (!this.onboarding.seenBefore) {
      this.onboarding.begin();
      this.openHelp();
    } else {
      this.input.requestLock();
    }
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
      this.effects.load(data.effects);
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
      this.equipment.refresh(this.inventory); // re-equip best armor from the loaded inventory

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

    // Settings and Help can be opened from the title screen (state "intro"), so
    // their keyboard close must be handled outside the "playing" gate too.
    if (this.state === "playing" || this.settingsMenu.visible || this.helpScreen.visible) {
      this.handleUIToggles();
    }
    this.updateVeilEpisode(dt);

    if (simulating) {
      this.swingCooldown = Math.max(0, this.swingCooldown - dt);
      this.controller.update(dt, this.input, this.world, this.stats);
      this.dayNight.update(dt, this.controller.camera.position);
      this.weather.update(dt, this.controller.camera.position);
      this.applyBiomeFog();
      this.world.updateBiomeLights(pos.x, pos.z);

      // GDD §4.2 — tick status effects; their damage + decay mults feed the sim.
      const fxAgg = this.effects.update(dt);
      if (fxAgg.tickDamage > 0) this.stats.damage(fxAgg.tickDamage * dt);

      const env = this.computeEnvRates();
      this.stats.update(dt, {
        sprinting: this.controller.isSprinting,
        warmthDeltaPerMin: env.warmth,
        veilDeltaPerMin: env.veil,
        staminaRegenMult: this.augments.staminaRegenMult(),
        underground: this.isUnderground(),
        oxygenMax: CONFIG.oxygen.max * this.augments.oxygenMaxMult(),
        decayMult: this.settings.data.decayRate,
        effectHungerMult: fxAgg.hungerMult,
        effectHydrationMult: fxAgg.hydrationMult,
      });
      this.buildSystem.updatePower(
        dt,
        this.dayNight.daylight,
        this.weather.current === WeatherType.IonSurge,
      );
      this.updateCondensers(dt);
      this.updatePlanters(dt);
      // GDD §6.1 — storms wear the base shell.
      this.buildSystem.updateIntegrity(
        dt,
        this.weather.current === WeatherType.Ashstorm ? this.weather.intensity : 0,
        this.weather.current === WeatherType.IonSurge ? this.weather.intensity : 0,
      );

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
      this.fauna.crawlerFireResist = this.adaptation.crawlerFireAdapted;
      this.fauna.apexExhausted = this.adaptation.apexKills >= CONFIG.fauna.maxApexEncounters;
      this.fauna.update(dt, this.faunaContext(), this.safeZones());
      this.updateBaseDefense(dt);
      this.updateDeployables(dt);
      this.updateMotionSensors(dt);
      this.updateCaveIns(dt);
      // GDD §7.1 — carry ceiling: Carrier Frame augment + Alloy Pack Frame = 45kg.
      this.inventory.bonusWeight =
        this.augments.carryBonus() +
        (this.inventory.count("alloy_pack_frame") > 0 ? CONFIG.inventory.packFrameBonus : 0);
      this.lore.update(dt);
      this.runDiscovery();
      this.updateChatter(dt);
      this.updateNarrative();
      this.updateAudio(dt);
      this.updateLightning(dt);
      this.autosaveTimer = Math.max(0, this.autosaveTimer - dt);
      if (this.ownsMapper()) this.map.reveal(pos.x, pos.z, 100);
      if (this.stats.isDead) this.die();
    } else {
      this.interaction.current = null;
      this.dayNight.update(0, this.controller.camera.position);
    }

    this.scanCooldown = Math.max(0, this.scanCooldown - dt);
    this.updateMarkers(dt);
    this.updateImpacts(dt);

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
    if (this.composer) {
      this.updateGodRays();
      this.composer.render();
    } else {
      this.renderer.render(this.world.scene, this.controller.camera);
    }
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Aim the god-ray shafts at the sun's screen position; disable when it's hidden. */
  private updateGodRays(): void {
    if (!this.godrays) return;
    const cam = this.controller.camera;
    const sun = this.world.sun;
    const sd = this.tmpSunDir.copy(sun.position).sub(cam.position).normalize();
    cam.getWorldDirection(this.tmpCamDir);
    const facing = sd.dot(this.tmpCamDir); // >0 → sun in front of the camera
    const day = this.dayNight.daylight;
    if (facing > 0.15 && day > 0.05) {
      this.tmpSunProj.copy(sun.position).project(cam);
      this.godrays.uniforms.lightPos.value.set(
        this.tmpSunProj.x * 0.5 + 0.5,
        this.tmpSunProj.y * 0.5 + 0.5,
      );
      const fade = Math.min(1, (facing - 0.15) / 0.4);
      this.godrays.uniforms.exposure.value = CONFIG.postfx.godrayExposure * day * fade;
    } else {
      this.godrays.uniforms.exposure.value = 0;
    }
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
    if (this.helpScreen.visible) {
      if (this.input.wasPressed("Tab") || this.input.wasPressed("KeyH") || esc) this.closeHelp();
      return;
    }
    if (this.input.wasPressed("KeyH")) this.openHelp();
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
      recipes: this.crafting.recipes
        .filter((r) => this.knowledge.isKnown(r.id))
        .map((r) => ({
          name: r.name,
          tier: r.tier,
          ingredients: r.ingredients
            .map((i) => `${i.quantity}× ${getItem(i.itemId).name}`)
            .join(", "),
        })),
      augments: AUGMENTS.map((a) => ({
        name: a.name,
        installed: this.augments.installedIds.includes(a.id),
      })),
      slotsUsed: this.augments.usedSlots(),
      slotsMax: this.augments.maxSlots,
      lastScan: this.lastScan,
    });
    this.surveyLog.onRenderMap = (canvas) => {
      const p = this.controller.position;
      this.minimap.renderLarge(canvas, this.map, p.x, p.z, this.controller.forwardYaw);
    };
  }

  private anyMenuOpen(): boolean {
    return (
      this.menu.visible ||
      this.storage.visible ||
      this.loreReader.visible ||
      this.augmentUI.visible ||
      this.surveyLog.visible ||
      this.settingsMenu.visible ||
      this.helpScreen.visible
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

  private openHelp(): void {
    this.audio.ui();
    this.helpScreen.open();
    if (this.state === "playing") this.input.exitLock();
  }
  private closeHelp(): void {
    this.helpScreen.hide();
    // Closing the first-run auto-shown help marks onboarding seen (no re-nag).
    if (this.onboarding.active) this.onboarding.markSeen();
    if (this.state === "playing") this.input.requestLock();
  }

  /** Tick off a getting-started step; celebrate when the basics are all learned. */
  private tickOnboarding(id: string): void {
    if (!this.onboarding.complete(id)) return;
    this.audio.ui();
    if (this.onboarding.allDone) {
      this.onboarding.active = false;
      this.onboarding.markSeen();
      this.hud.toast("Survival basics learned — good luck on Vaelun.");
    }
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
    const item = this.equippedItemId ? getItem(this.equippedItemId) : null;
    if (item?.ranged) {
      this.fireRanged(item.ranged);
      return;
    }
    if (this.swingCooldown > 0) return;
    if (!this.stats.trySpendStamina(CONFIG.combat.swingStaminaCost)) {
      this.swingCooldown = 0.3;
      return;
    }
    this.swingCooldown = CONFIG.combat.swingCooldownSec;
    this.controller.triggerSwing();
    const dmg = item?.toolDamage ?? CONFIG.combat.unarmedDamage;
    const dmgType = item?.damageType ?? "physical";
    const res = this.fauna.meleeHit(
      this.controller.camera.position,
      this.controller.forward(),
      CONFIG.combat.meleeRange,
      CONFIG.combat.meleeArcDot,
      dmg,
      CONFIG.combat.knockback,
      dmgType,
    );
    if (res.hit && !res.blocked) {
      this.audio.hit();
      this.hud.hitMarker();
      this.controller.addShake(res.killed ? CONFIG.feel.killShake : CONFIG.feel.hitShake);
      if (res.point) this.spawnImpact(res.point, res.killed ? 0xffd9a0 : 0xff7a5a, res.killed ? 12 : 6);
    }
    if (res.killed) {
      this.handleKill(res, dmgType);
    } else if (res.blocked) {
      // GDD §10.2 — a blocked swing costs more stamina than a normal one.
      this.stats.drainStamina(
        CONFIG.combat.blockedSwingStaminaCost - CONFIG.combat.swingStaminaCost,
      );
      this.hud.toast(`${res.name} blocks your strike`);
    }
    this.wearTool(CONFIG.tools.meleeWearPerHit);
  }

  /** GDD §10.1/§10.2 — fire the equipped ranged weapon (crafted ammo, no infinite). */
  private fireRanged(ranged: NonNullable<ItemDef["ranged"]>): void {
    if (this.swingCooldown > 0) return;
    if (this.inventory.count(ranged.ammoItemId) <= 0) {
      this.swingCooldown = 0.3;
      this.hud.toast(`Out of ${getItem(ranged.ammoItemId).name}s`);
      return;
    }
    this.swingCooldown = 0.34;
    this.inventory.remove(ranged.ammoItemId, 1);
    this.controller.triggerSwing();
    this.controller.addShake(0.045); // recoil kick
    this.audio.zap();
    const origin = this.controller.camera.position;
    const dir = this.controller.forward();
    const res = this.fauna.rayHit(origin, dir, ranged.range, ranged.damage, ranged.damageType);
    if (res.hit && res.point) {
      this.hud.hitMarker();
      this.spawnImpact(res.point, 0x9ad8ff, res.killed ? 12 : 6);
    } else {
      // Bolt grounds out down-range — a faint crackle where it died.
      const end = this.tmpSunDir.copy(dir).multiplyScalar(Math.min(ranged.range, 24)).add(origin);
      this.spawnImpact(end, 0x4a78a8, 2);
    }
    if (res.killed) this.handleKill(res, ranged.damageType);
    this.wearTool(CONFIG.tools.rangedWearPerShot); // GDD §10.3 barrel wear
  }

  /** Shared kill resolution: loot, toast, and adaptation tracking (GDD §9.4). */
  private handleKill(res: MeleeResult, damageType: DamageType): void {
    const gained: string[] = [];
    for (const l of res.loot) {
      const added = this.inventory.add(l.itemId, l.qty);
      if (added > 0) gained.push(`${added} ${getItem(l.itemId).name}`);
    }
    this.hud.toast(`${res.name} slain${gained.length ? " — +" + gained.join(", ") : ""}`);
    // GDD §9.4 — Vaelun studies your tactics: fire-killing Crawlers teaches them.
    if (damageType === "fire" && res.creatureId === "C04") {
      if (this.adaptation.recordCrawlerFireKill()) {
        this.hud.toast("The Crawlers are adapting — fire bites shallower now.");
        this.narrative.pushBeat("Crawler carapaces are changing. The flame lesson has been learned.");
      }
    }
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
    // GDD §11.2 — scanner data saves to the Survey Log.
    this.lastScan = {
      clock: this.dayNight.clockString,
      biome: BIOME_LABEL[biomeAt(pos.x, pos.z)],
      deposits,
      lore: loreCount,
      fauna: creatures,
    };

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

  /** Game-feel: a short burst of sparks at a melee hit / kill (GDD-adjacent juice). */
  private spawnImpact(at: THREE.Vector3, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        IMPACT_GEO,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
      );
      mesh.position.copy(at);
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 3;
      const vel = new THREE.Vector3(Math.cos(a) * r, 1 + Math.random() * 3, Math.sin(a) * r);
      this.world.scene.add(mesh);
      this.impacts.push({ mesh, vel, ttl: 0.45, max: 0.45 });
    }
    while (this.impacts.length > 120) {
      const old = this.impacts.shift()!;
      this.world.scene.remove(old.mesh);
      (old.mesh.material as THREE.Material).dispose();
    }
  }

  private updateImpacts(dt: number): void {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const p = this.impacts[i];
      p.ttl -= dt;
      p.vel.y -= 12 * dt; // gravity on the sparks
      p.mesh.position.addScaledVector(p.vel, dt);
      const f = Math.max(0, p.ttl / p.max);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = f * 0.95;
      p.mesh.scale.setScalar(0.4 + f * 0.6);
      if (p.ttl <= 0) {
        this.world.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      }
    }
  }

  /** GDD §10.1 — toss a flare (repels fauna) or a decoy canister (lures fauna). */
  private deployGadget(kind: "flare" | "decoy"): void {
    const g = CONFIG.gadgets;
    const yaw = this.controller.forwardYaw;
    const px = this.controller.position.x + -Math.sin(yaw) * g.throwDistance;
    const pz = this.controller.position.z + -Math.cos(yaw) * g.throwDistance;
    const py = this.world.groundHeight(px, pz);
    const mesh = new THREE.Group();
    let light: THREE.PointLight | null = null;
    if (kind === "flare") {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6),
        new THREE.MeshStandardMaterial({
          color: 0x3a1a08,
          emissive: 0xff4a2a,
          emissiveIntensity: 2.4,
        }),
      );
      stick.rotation.z = Math.PI / 2.4;
      stick.position.y = 0.08;
      mesh.add(stick);
      light = new THREE.PointLight(0xff5a3a, 5, 22, 1.4);
      light.position.y = 0.5;
      mesh.add(light);
      this.audio.flare();
      this.hud.toast("Flare lit — native fauna won't approach the glare");
    } else {
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.34, 8),
        new THREE.MeshStandardMaterial({
          color: 0x4a5158,
          emissive: 0x3fe6c8,
          emissiveIntensity: 0.9,
          metalness: 0.5,
          roughness: 0.4,
        }),
      );
      can.position.y = 0.17;
      mesh.add(can);
      this.audio.scan();
      this.hud.toast("Decoy hissing — they'll hunt the noise, not you");
    }
    mesh.position.set(px, py, pz);
    this.world.scene.add(mesh);
    this.deployables.push({
      kind,
      mesh,
      light,
      ttl: kind === "flare" ? g.flareTtlSec : g.decoyTtlSec,
      pos: new THREE.Vector3(px, py, pz),
    });
  }

  private updateDeployables(dt: number): void {
    for (let i = this.deployables.length - 1; i >= 0; i--) {
      const d = this.deployables[i];
      d.ttl -= dt;
      if (d.light) d.light.intensity = 4 + Math.random() * 2.5; // flare gutter/flicker
      if (d.kind === "decoy") d.mesh.rotation.y += dt * 3;
      if (d.ttl <= 0) {
        this.spawnImpact(d.pos, d.kind === "flare" ? 0xff5a3a : 0x3fe6c8, 4);
        this.world.scene.remove(d.mesh);
        d.mesh.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh) {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
          }
        });
        this.deployables.splice(i, 1);
      }
    }
  }

  /** Nearest active gadget of a kind (for the fauna context), or null. */
  private gadgetPos(kind: "flare" | "decoy"): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    const p = this.controller.position;
    for (const d of this.deployables) {
      if (d.kind !== kind) continue;
      const dist = (d.pos.x - p.x) ** 2 + (d.pos.z - p.z) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = d.pos;
      }
    }
    return best;
  }

  private clearMarkers(): void {
    for (const m of this.scanMarkers) {
      this.world.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.Material).dispose();
    }
    this.scanMarkers.length = 0;
    for (const p of this.impacts) {
      this.world.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.impacts.length = 0;
    for (const d of this.deployables) {
      this.world.scene.remove(d.mesh);
      d.mesh.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    }
    this.deployables.length = 0;
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
      lure: this.gadgetPos("decoy"),
      repel: this.gadgetPos("flare"),
      damagePlayer: (amount: number) => {
        this.stats.damage(
          amount *
            this.augments.damageTakenMult() *
            this.equipment.damageMult() *
            this.settings.damageMult(),
        );
        this.wearArmor();
        this.hud.flashDamage();
        this.audio.hurt();
        this.controller.addShake(
          Math.min(CONFIG.feel.shakeMax, CONFIG.feel.hurtShake + amount * 0.003),
        );
      },
    };
  }

  /** GDD §7.1/§10.3 — worn armor degrades when it absorbs a hit; broken pieces fall off. */
  private wearArmor(): void {
    let broke = false;
    for (const id of this.equipment.wornIds) {
      if (this.inventory.damageDurability(id, CONFIG.armor.wearPerHit) === "broke") {
        this.hud.toast(`${getItem(id).name} destroyed`);
        broke = true;
      }
    }
    if (broke) this.equipment.refresh(this.inventory);
  }

  private collectLore(fragment: LoreFragment): void {
    if (this.lore.isFound(fragment.id)) return;
    this.lore.collect(fragment);
    this.audio.pickup();
    this.loreReader.show(fragment, this.lore.foundCount, TOTAL_FRAGMENTS);
    this.input.exitLock();
    this.hud.toast(`Lore fragment recovered (${this.lore.foundCount}/${TOTAL_FRAGMENTS})`);
    this.autoSave();
    // GDD §5.1 — some fragments teach a recipe outright (the non-experiment path).
    if (fragment.unlocksRecipeId && this.knowledge.learn(fragment.unlocksRecipeId)) {
      const r = this.crafting.recipes.find((x) => x.id === fragment.unlocksRecipeId);
      this.hud.toast(`Schematic recovered: ${r ? r.name : "new recipe"}`);
    }
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
    if (site.augmentItemId && this.inventory.add(site.augmentItemId, 1) > 0) {
      gained.push(getItem(site.augmentItemId).name);
    }
    this.crashSites.recover(site);
    this.equipment.refresh(this.inventory); // in case salvage included armor
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
    this.inventory.bonusWeight =
      this.augments.carryBonus() +
      (this.inventory.count("alloy_pack_frame") > 0 ? CONFIG.inventory.packFrameBonus : 0);
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

  /** GDD §4.3 — drink unfiltered Veil-rain: hydrates but raises Veil Exposure. */
  private drinkVeilRain(): void {
    this.stats.drink(CONFIG.veil.rainDrinkHydration);
    this.stats.veilExposure = Math.min(
      CONFIG.veil.max,
      this.stats.veilExposure + CONFIG.veil.rainDrinkVeil,
    );
    this.hud.toast(
      `Drank Veil-rain — hydration +${CONFIG.veil.rainDrinkHydration}, Veil +${CONFIG.veil.rainDrinkVeil}`,
    );
    this.tickOnboarding("sustain");
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

  /** GDD §6.2 Motion Sensor — ping when fauna prowl near a sensor. */
  private updateMotionSensors(dt: number): void {
    this.sensorCooldown = Math.max(0, this.sensorCooldown - dt);
    const sensors = this.buildSystem.sensorPositions;
    if (sensors.length === 0 || this.sensorCooldown > 0) return;
    const r2 = CONFIG.sensor.radius ** 2;
    for (const c of this.fauna.creatures) {
      if (!c.alive) continue;
      for (let i = 0; i < sensors.length; i++) {
        const dx = c.pos.x - sensors[i].x;
        const dz = c.pos.z - sensors[i].z;
        if (dx * dx + dz * dz <= r2) {
          this.sensorCooldown = CONFIG.sensor.cooldownSec;
          this.audio.scan();
          this.hud.toast(`⚠ Motion sensor: ${c.def.name} near the base`);
          return;
        }
      }
    }
  }

  /** GDD §2 — Crust Warrens cave-ins: a groan, then the roof comes down. */
  private updateCaveIns(dt: number): void {
    if (!this.isUnderground()) {
      this.caveInWarn = -1;
      return;
    }
    if (this.caveInWarn >= 0) {
      this.caveInWarn -= dt;
      this.controller.addShake(0.02); // sustained rumble during the telegraph
      if (this.caveInWarn <= 0) {
        this.caveInWarn = -1;
        const p = this.controller.position;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 4;
        const at = this.tmpSunDir.set(p.x + Math.cos(a) * r, p.y + 2.2, p.z + Math.sin(a) * r);
        this.spawnImpact(at, 0x8a7a64, 14); // rock burst
        this.audio.thunder();
        this.controller.addShake(0.18);
        const d2 = (at.x - p.x) ** 2 + (at.z - p.z) ** 2;
        if (d2 <= CONFIG.caveIn.radius ** 2) {
          this.stats.damage(CONFIG.caveIn.damage * this.equipment.damageMult());
          this.hud.flashDamage();
          this.audio.hurt();
          this.hud.toast("Caught in the cave-in!");
        } else {
          this.hud.toast("Rock crashes down nearby — the Warrens are unstable");
        }
      }
      return;
    }
    this.caveInTimer -= dt;
    if (this.caveInTimer <= 0) {
      this.caveInTimer =
        CONFIG.caveIn.minGapSec + Math.random() * (CONFIG.caveIn.maxGapSec - CONFIG.caveIn.minGapSec);
      this.caveInWarn = CONFIG.caveIn.warnSec;
      this.audio.bellow(); // a deep geological groan
      this.hud.toast("The roof groans above you…");
    }
  }

  /** Ion-surge lightning: random sky-flash + thunder while the storm rages. */
  private updateLightning(dt: number): void {
    if (this.weather.current !== WeatherType.IonSurge || this.weather.intensity < 0.4) {
      this.lightningTimer = Math.min(this.lightningTimer, CONFIG.lightning.minGapSec);
      return;
    }
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer =
        CONFIG.lightning.minGapSec +
        Math.random() * (CONFIG.lightning.maxGapSec - CONFIG.lightning.minGapSec);
      this.hud.flashLightning();
      this.audio.thunder();
      this.controller.addShake(0.06);
    }
  }

  /** GDD §6.1 — patch a weather-worn shell piece with maintenance materials. */
  private repairStructure(module: PlacedModule): void {
    if (module.integrity >= 100) {
      this.hud.toast(`${module.def.name} is intact`);
      return;
    }
    const cost = CONFIG.integrity.repairCost;
    if (!this.inventory.has("ash_sediment", cost)) {
      this.hud.toast(`Repair needs ${cost} Ash-sediment`);
      return;
    }
    this.inventory.remove("ash_sediment", cost);
    module.integrity = Math.min(100, module.integrity + CONFIG.integrity.repairAmount);
    this.audio.craft();
    this.hud.toast(`${module.def.name} repaired — ${Math.round(module.integrity)}%`);
  }

  /**
   * GDD §6.2 Research — the Analysis Bench deciphers one unknown schematic for
   * a material cost (the non-experimentation, non-lore recipe path).
   */
  private analyzeBench(): void {
    const cost = CONFIG.analysis.cost;
    const unknown = this.crafting.recipes.filter(
      (r) =>
        !this.knowledge.isKnown(r.id) &&
        (r.tier < 2 || this.tier2Unlocked) &&
        (r.tier < 3 || this.tier3Unlocked),
    );
    if (unknown.length === 0) {
      this.hud.toast("The bench finds nothing new — every schematic is deciphered");
      return;
    }
    if (!cost.every((c) => this.inventory.has(c.itemId, c.quantity))) {
      const need = cost.map((c) => `${c.quantity} ${getItem(c.itemId).name}`).join(", ");
      this.hud.toast(`Analysis needs: ${need}`);
      return;
    }
    for (const c of cost) this.inventory.remove(c.itemId, c.quantity);
    const recipe = unknown[Math.floor(Math.random() * unknown.length)];
    this.knowledge.learn(recipe.id);
    this.audio.scan();
    this.audio.craft();
    this.hud.toast(`Schematic deciphered: ${recipe.name}`);
  }

  /** GDD §4.3 — plant / tend / harvest the Hydroponic Planter. */
  private farmPlanter(module: PlacedModule): void {
    const grow = CONFIG.farm.growSeconds;
    const g = module.growth ?? -1;
    if (g < 0) {
      if (!this.inventory.has("spore_cap", 1)) {
        this.hud.toast("Planting needs a raw Spore-cap as seed stock");
        return;
      }
      this.inventory.remove("spore_cap", 1);
      module.growth = 0;
      this.audio.gather();
      this.hud.toast("Spore-cap planted — give it time and it grows clean");
      return;
    }
    if (g < grow) {
      this.hud.toast(`Crop growing — ${Math.round((g / grow) * 100)}%`);
      return;
    }
    const added = this.inventory.add("cultivated_cap", CONFIG.farm.yield);
    if (added <= 0) {
      this.hud.toast("Inventory full — over carry weight");
      return;
    }
    module.growth = -1;
    this.audio.pickup();
    this.hud.toast(`Harvested ${added} Cultivated Spore-cap${added === 1 ? "" : "s"} — safe to eat`);
  }

  /** Advance planter crops (called each simulating frame). */
  private updatePlanters(dt: number): void {
    for (const m of this.buildSystem.placed) {
      if (m.type !== ModuleType.Planter || m.growth === undefined || m.growth < 0) continue;
      if (m.growth < CONFIG.farm.growSeconds) {
        m.growth = Math.min(CONFIG.farm.growSeconds, m.growth + dt);
      }
    }
  }

  /** GDD §6.3 — top up a Generator with Bioluminite fuel. */
  private refuelGenerator(module: PlacedModule): void {
    const P = CONFIG.power;
    const have = this.inventory.count("bioluminite");
    if (have <= 0) {
      this.hud.toast("Generator needs Bioluminite as fuel");
      return;
    }
    const need = Math.ceil((P.genFuelMax - (module.fuel ?? 0)) / P.genFuelPerUnit);
    const use = Math.min(have, Math.max(0, need));
    if (use <= 0) {
      this.hud.toast("Generator fuel is full");
      return;
    }
    this.inventory.remove("bioluminite", use);
    module.fuel = Math.min(P.genFuelMax, (module.fuel ?? 0) + use * P.genFuelPerUnit);
    this.audio.craft();
    this.hud.toast(`Refuelled generator — ${use} Bioluminite`);
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
    this.tickOnboarding("sustain");
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
        this.hud.toast(`Built ${res.def.name}`);
        this.autoSave();
        this.tickOnboarding("build");
      } else {
        this.hud.toast(res.reason);
      }
    }
  }

  private interact(): void {
    const t = this.interaction.current;
    if (!t) {
      // GDD §4.3 — with no target, drink unfiltered Veil-rain if it's falling.
      if (this.weather.current === WeatherType.VeilRain) this.drinkVeilRain();
      return;
    }

    if (t.kind === "module") {
      const kind = t.module.def.interact;
      if (kind === "sleep") this.sleepAndSave();
      else if (kind === "storage") this.openStorage(t.module);
      else if (kind === "fabricator") this.openFabricator();
      else if (kind === "medical") this.openMedical(t.module);
      else if (kind === "condenser") this.drinkCondenser(t.module);
      else if (kind === "cook") this.cookFood();
      else if (kind === "refuel") this.refuelGenerator(t.module);
      else if (kind === "farm") this.farmPlanter(t.module);
      else if (kind === "analyze") this.analyzeBench();
      else this.repairStructure(t.module); // damaged shell piece (GDD §6.1)
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
      this.tickOnboarding("sustain");
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
    this.tickOnboarding("gather");
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
          // GDD §4.3: raw food risks a timed Gut-rot effect, negated by Iron Gut (A01).
          if (itemId === "spore_cap" && !this.augments.hasIronGut() && Math.random() < 0.3) {
            this.effects.add("gut_rot", CONFIG.effects.gutRotDuration);
            this.audio.hurt();
            this.hud.toast("Gut-rot sets in — the raw spore-cap turns your stomach");
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
        } else if (use?.kind === "flare" || use?.kind === "decoy") {
          this.deployGadget(use.kind);
        }
        if (use?.kind === "eat" || use?.kind === "drink") this.tickOnboarding("sustain");
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
    this.stats.veilExposure = Math.max(0, this.stats.veilExposure - CONFIG.veil.restReduce); // GDD §4.1
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
      effects: this.effects.serialize(),
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
      this.equipment.refresh(this.inventory); // auto-equip if we just crafted better armor
      this.hud.toast(`Crafted ${recipe.name}`);
      this.tickOnboarding("craft");
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
        toolName = item.ranged
          ? `${item.name} · ${this.inventory.count(item.ranged.ammoItemId)} ⚡`
          : item.name;
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
      armorReduction: this.equipment.reduction(),
      power: (() => {
        const gr = this.buildSystem.gridState();
        return gr.hasInfra
          ? { status: gr.status, output: gr.output, draw: gr.draw, batteryFrac: gr.batteryFrac }
          : null;
      })(),
      onboarding: this.onboarding.active
        ? this.onboarding.steps.map((s) => ({ label: s.label, done: s.done }))
        : null,
      effects: this.effects.active.map((e) => ({
        name: e.def.name,
        remaining: Math.ceil(e.remaining),
      })),
      tracer: this.computeTracer(),
      prompt: t
        ? `<span class="key">[E]</span> ${t.verb} ${t.label}`
        : !this.buildSystem.active && this.weather.current === WeatherType.VeilRain
          ? `<span class="key">[E]</span> Drink Veil-rain`
          : null,
      lookingAtNode: !!t,
      hotbar,
      toolName,
      toolDurability,
      minimalHud: !this.settings.data.alwaysShowStats,
    });
  }
}
