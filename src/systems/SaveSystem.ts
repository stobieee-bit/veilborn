import { CONFIG } from "../config";
import type { ModuleSave } from "../building/BuildSystem";

/** Full persisted game state (GDD §15). */
export interface SaveData {
  version: number;
  timeOfDay: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  stats: {
    health: number;
    stamina: number;
    hunger: number;
    hydration: number;
    warmth: number;
    veilExposure: number;
  };
  inventory: {
    stacks: { itemId: string; quantity: number; durability?: number }[];
    hotbar: (string | null)[];
  };
  equippedItemId: string | null;
  selectedSlot: number;
  known: string[];
  lore: string[];
  explored: number[];
  augments: string[];
  crashRecovered: string[];
  tier2: boolean;
  tier3: boolean;
  narrative: {
    cradleReached: boolean;
    blackBoxCount: number;
    beats: string[];
    asked: string[];
    encountered: string[];
  };
  adaptation: { apexMeleeHits: number; apexKills: number };
  modules: ModuleSave[];
  nodes: { id: string; remaining: number }[];
}

const VERSION = 1;

export function saveExists(): boolean {
  try {
    return localStorage.getItem(CONFIG.save.key) !== null;
  } catch {
    return false;
  }
}

export function writeSave(data: Omit<SaveData, "version">): boolean {
  try {
    localStorage.setItem(CONFIG.save.key, JSON.stringify({ version: VERSION, ...data }));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(CONFIG.save.key);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(CONFIG.save.key);
  } catch {
    /* ignore */
  }
}
