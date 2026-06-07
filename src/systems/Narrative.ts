/**
 * GDD §12 — story progression: act, objective, fired beats, ARIA topics asked,
 * and creatures encountered (for the Survey Log). Act is derived from black-box
 * recovery (Act 2) and reaching the Cradle (Act 3).
 */
export const OBJECTIVES: Record<number, string> = {
  1: "Survive Vaelun. Read the world. Seek what remains of CALDERA.",
  2: "Recover the black-box fragments. Learn why the planet hunts you.",
  3: "Reach the Cradle. Repair the signal array — or surrender to the Veil.",
};

export class Narrative {
  cradleReached = false;
  blackBoxCount = 0;
  readonly beats: string[] = [];
  private readonly asked = new Set<string>();
  private readonly encountered = new Set<string>();

  reset(): void {
    this.cradleReached = false;
    this.blackBoxCount = 0;
    this.beats.length = 0;
    this.asked.clear();
    this.encountered.clear();
  }

  get act(): number {
    if (this.cradleReached) return 3;
    if (this.blackBoxCount >= 1) return 2;
    return 1;
  }

  get objective(): string {
    return OBJECTIVES[this.act];
  }

  pushBeat(msg: string): void {
    this.beats.push(msg);
  }

  ask(id: string): void {
    this.asked.add(id);
  }
  hasAsked(id: string): boolean {
    return this.asked.has(id);
  }

  encounter(id: string): boolean {
    if (this.encountered.has(id)) return false;
    this.encountered.add(id);
    return true; // first encounter
  }
  encounteredIds(): string[] {
    return [...this.encountered];
  }

  serialize(): {
    cradleReached: boolean;
    blackBoxCount: number;
    beats: string[];
    asked: string[];
    encountered: string[];
  } {
    return {
      cradleReached: this.cradleReached,
      blackBoxCount: this.blackBoxCount,
      beats: [...this.beats],
      asked: [...this.asked],
      encountered: [...this.encountered],
    };
  }

  load(d: Partial<ReturnType<Narrative["serialize"]>> | undefined): void {
    this.reset();
    if (!d) return;
    this.cradleReached = d.cradleReached ?? false;
    this.blackBoxCount = d.blackBoxCount ?? 0;
    for (const b of d.beats ?? []) this.beats.push(b);
    for (const a of d.asked ?? []) this.asked.add(a);
    for (const e of d.encountered ?? []) this.encountered.add(e);
  }
}
