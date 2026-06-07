interface Slide {
  kicker: string;
  text: string;
}

/** GDD §12.1 endings + §17 credits/epilogue slides. */
const ESCAPE: Slide[] = [
  { kicker: "ENDING A · ESCAPE", text: "You feed the last cell into the array. It wakes — a single tone climbing into the amber dark." },
  { kicker: "ENDING A · ESCAPE", text: "Across the planet the fog turns toward the sound, and for once does not move to silence it." },
  { kicker: "ENDING A · ESCAPE", text: "Days later an evac ship breaks the cloud. You climb aboard with your salvage and your scars." },
  { kicker: "ENDING A · ESCAPE", text: "Vaelun shrinks below you, glowing, patient. You kept the human shape of yourself — and its guilt." },
];

const INTEGRATION: Slide[] = [
  { kicker: "ENDING B · INTEGRATION", text: "You let the Veil crest, and you do not fight it. The radio voices fold into a single chord." },
  { kicker: "ENDING B · INTEGRATION", text: "It does not consume you. It includes you — Yena, Tolc, Kai, the first people, and now you." },
  { kicker: "ENDING B · INTEGRATION", text: "The hunting stops. The whole world exhales. You will never leave Vaelun. You no longer want to." },
  { kicker: "ENDING B · INTEGRATION", text: "An evac ship will arrive to find an empty pod and a planet that, at last, feels whole." },
];

const FIRST_CONTACT: Slide = {
  kicker: "EPILOGUE · FIRST CONTACT",
  text: "Every fragment recovered, the broken-line glyph completes. Humanity refused the question once. You did not. The accord is rewritten.",
};

const CREDITS: Slide = {
  kicker: "VEILBORN",
  text: "A Phase 1–10 prototype — Three.js · TypeScript · Vite.\nThank you for surviving Vaelun.\n\n(click to return to the title)",
};

export class EndingScreen {
  readonly root: HTMLDivElement;
  visible = false;

  private slides: Slide[] = [];
  private idx = 0;
  private onDone: () => void = () => {};
  private readonly kickerEl: HTMLDivElement;
  private readonly textEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "ending-screen hidden";
    this.root.innerHTML = `
      <div class="es-inner">
        <div class="es-kicker"></div>
        <div class="es-text"></div>
        <div class="es-cta">click to continue</div>
      </div>`;
    parent.appendChild(this.root);
    this.kickerEl = this.root.querySelector(".es-kicker")!;
    this.textEl = this.root.querySelector(".es-text")!;
    this.root.addEventListener("click", () => this.advance());
  }

  show(kind: "escape" | "integration", allFragments: boolean, onDone: () => void): void {
    this.slides = [...(kind === "escape" ? ESCAPE : INTEGRATION)];
    if (allFragments) this.slides.push(FIRST_CONTACT);
    this.slides.push(CREDITS);
    this.idx = 0;
    this.onDone = onDone;
    this.visible = true;
    this.root.classList.remove("hidden");
    this.render();
  }

  private advance(): void {
    this.idx++;
    if (this.idx >= this.slides.length) {
      this.visible = false;
      this.root.classList.add("hidden");
      this.onDone();
      return;
    }
    this.render();
  }

  private render(): void {
    const s = this.slides[this.idx];
    this.kickerEl.textContent = s.kicker;
    this.textEl.textContent = s.text;
  }
}
