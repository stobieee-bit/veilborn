/**
 * First-run "Getting Started" guide. Shows a small HUD checklist on a new
 * player's first New Game and ticks steps off as they perform the core-loop
 * actions. Persists a "seen" flag so it never nags a returning player.
 */
const KEY = "veilborn_onboarded";

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
}

export class Onboarding {
  active = false;
  readonly steps: OnboardingStep[] = [
    { id: "gather", label: "Gather a resource — aim at a node, press [E]", done: false },
    { id: "craft", label: "Open crafting [Tab] and craft a Stone Blade", done: false },
    { id: "sustain", label: "Eat or drink to manage survival", done: false },
    { id: "build", label: "Enter build mode [B] and place a structure", done: false },
  ];

  /** True once the player has been through onboarding before (persisted). */
  get seenBefore(): boolean {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  }

  /** Start the first-run guide (call on New Game when not seen before). */
  begin(): void {
    this.active = true;
    for (const s of this.steps) s.done = false;
  }

  /** Persist that the player has seen onboarding (won't auto-show again). */
  markSeen(): void {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  }

  /** Mark a step done. Returns true only on the transition to done. */
  complete(id: string): boolean {
    if (!this.active) return false;
    const s = this.steps.find((x) => x.id === id);
    if (!s || s.done) return false;
    s.done = true;
    return true;
  }

  get allDone(): boolean {
    return this.steps.every((s) => s.done);
  }
}
