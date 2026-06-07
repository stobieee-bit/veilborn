/**
 * GDD §14 — procedural audio. No sample assets: everything is synthesised with
 * the Web Audio API. Continuous music layers crossfade by game state; SFX are
 * one-shot envelopes. Every method is defensive so audio can never break the
 * game (AudioContext needs a user gesture, may be unavailable, etc.).
 */
export type MusicState = "calm" | "explore" | "threat" | "combat" | "episode";

interface Layer {
  gain: GainNode;
  oscs: OscillatorNode[];
}

const MIX: Record<MusicState, { drone: number; pad: number; tension: number; perc: number }> = {
  calm: { drone: 0.32, pad: 0.16, tension: 0.0, perc: 0.0 },
  explore: { drone: 0.26, pad: 0.26, tension: 0.0, perc: 0.0 },
  threat: { drone: 0.22, pad: 0.2, tension: 0.22, perc: 0.16 },
  combat: { drone: 0.16, pad: 0.08, tension: 0.4, perc: 0.34 },
  episode: { drone: 0.12, pad: 0.0, tension: 0.5, perc: 0.1 },
};

export class AudioSystem {
  started = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private drone!: Layer;
  private pad!: Layer;
  private tension!: Layer;
  private perc!: Layer;
  private noiseBuf: AudioBuffer | null = null;
  private volume = 0.7;
  private muted = false;
  private state: MusicState | null = null;
  private night = false;

  /** Create the context + music graph. Call from a user gesture. */
  ensureStarted(): void {
    if (this.started) {
      this.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.gain(0.8, this.master);
      this.sfxBus = this.gain(0.9, this.master);
      this.buildNoise();
      this.drone = this.makeLayer([55, 55.4], "sine", this.musicBus);
      this.pad = this.makeLayer([220, 277.2, 329.6], "sine", this.musicBus);
      this.tension = this.makeLayer([110, 116.5], "sawtooth", this.musicBus);
      this.perc = this.makePerc(this.musicBus);
      this.started = true;
      this.applyMix();
    } catch {
      this.ctx = null;
    }
  }

  resume(): void {
    try {
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  setMusic(state: MusicState, night: boolean): void {
    if (state === this.state && night === this.night) return;
    this.state = state;
    this.night = night;
    this.applyMix();
  }

  // --- SFX ------------------------------------------------------------------
  footstep(): void {
    this.noise(0.12, 0.18, 300, 1.5);
  }
  gather(): void {
    this.tone(520, 0.1, "triangle", 0.18);
    this.tone(780, 0.09, "triangle", 0.12, 0.04);
  }
  craft(): void {
    this.tone(330, 0.16, "square", 0.16);
    this.tone(247, 0.18, "square", 0.12, 0.08);
  }
  pickup(): void {
    this.tone(660, 0.1, "sine", 0.2);
    this.tone(880, 0.1, "sine", 0.18, 0.06);
    this.tone(1175, 0.12, "sine", 0.16, 0.12);
  }
  hit(): void {
    this.noise(0.09, 0.28, 1400, 1);
    this.tone(170, 0.1, "sawtooth", 0.22);
  }
  hurt(): void {
    this.tone(110, 0.28, "sawtooth", 0.32);
    this.noise(0.18, 0.18, 500, 0.7);
  }
  bellow(): void {
    this.tone(68, 0.7, "sawtooth", 0.32);
    this.noise(0.5, 0.2, 220, 0.6);
  }
  scan(): void {
    this.tone(900, 0.07, "sine", 0.18);
    this.tone(1350, 0.07, "sine", 0.14, 0.05);
  }
  ui(): void {
    this.tone(540, 0.05, "sine", 0.12);
  }

  // --- internals ------------------------------------------------------------
  private applyMix(): void {
    if (!this.ctx || !this.state) return;
    const m = MIX[this.state];
    const t = this.ctx.currentTime;
    const nightDim = this.night ? 0.7 : 1;
    this.drone.gain.gain.setTargetAtTime(m.drone * (this.night ? 1.2 : 1), t, 0.8);
    this.pad.gain.gain.setTargetAtTime(m.pad * nightDim, t, 0.9);
    this.tension.gain.gain.setTargetAtTime(m.tension, t, 0.6);
    this.perc.gain.gain.setTargetAtTime(m.perc, t, 0.5);
    // Night drops the pad an octave-ish for a deeper, slower feel.
    const detune = this.night ? -700 : 0;
    for (const o of this.pad.oscs) o.detune.setTargetAtTime(detune, t, 1.5);
  }

  private gain(value: number, dest: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = value;
    g.connect(dest);
    return g;
  }

  private makeLayer(freqs: number[], type: OscillatorType, dest: AudioNode): Layer {
    const g = this.gain(0, dest);
    const oscs = freqs.map((f) => {
      const o = this.ctx!.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    return { gain: g, oscs };
  }

  private makePerc(dest: AudioNode): Layer {
    const g = this.gain(0, dest);
    const o = this.ctx!.createOscillator();
    o.type = "sine";
    o.frequency.value = 72;
    o.connect(g);
    o.start();
    // Tremolo: an LFO modulates the layer gain into a pulse.
    const lfo = this.ctx!.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1.6;
    const lfoGain = this.ctx!.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    lfo.start();
    return { gain: g, oscs: [o, lfo] };
  }

  private buildNoise(): void {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  private tone(freq: number, dur: number, type: OscillatorType, peak: number, delay = 0): void {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.sfxBus);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  private noise(dur: number, peak: number, filterFreq: number, q: number): void {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = filterFreq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.sfxBus);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch {
      /* ignore */
    }
  }
}
