import type { SfxEvent } from "./game/engine";

const LEAD = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 659.25, 523.25, 440, 523.25, 659.25, 587.33];
const BASS = [130.81, 130.81, 164.81, 130.81, 196, 164.81, 130.81, 98, 110, 130.81, 164.81, 146.83];

export class Sfx {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private step = 0;
  private nextAt = 0;

  constructor() {
    this.muted = localStorage.getItem("mfb-muted") === "1";
  }

  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.22;
      master.connect(ctx.destination);
      const music = ctx.createGain();
      music.gain.value = 0.28;
      music.connect(master);
      this.ctx = ctx;
      this.master = master;
      this.music = music;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem("mfb-muted", muted ? "1" : "0");
    if (this.master) this.master.gain.value = muted ? 0 : 0.22;
    if (muted) this.nextAt = 0;
  }

  play(ev: SfxEvent): void {
    if (!this.ctx || this.muted) return;
    switch (ev.name) {
      case "count":
        this.tone(420 + (ev.tone ?? 0) * 90, 0.12, "square", 0.28);
        break;
      case "fight":
        this.tone(220, 0.16, "square", 0.3, 660);
        this.noise(0.18, 0.12);
        break;
      case "summon":
        this.tone(340, 0.16, "triangle", 0.2, 520);
        break;
      case "hurt":
        this.tone(210, 0.11, "square", 0.24, -120);
        break;
      case "diff":
        this.tone(980, 0.07, "square", 0.22);
        this.tone(1480, 0.1, "square", 0.16);
        break;
      case "dead":
        this.tone(140, 0.28, "sawtooth", 0.22, -70);
        break;
      case "explode":
        this.noise(0.28, 0.2);
        this.tone(160, 0.2, "square", 0.2, 400);
        break;
      case "fusion":
        this.tone(523, 0.18, "triangle", 0.2);
        this.tone(784, 0.22, "triangle", 0.16);
        break;
      case "fanfare":
        [523, 659, 784, 1046].forEach((f, i) => {
          window.setTimeout(() => this.tone(f, 0.18, "square", 0.24), i * 120);
        });
        break;
    }
  }

  update(): void {
    if (!this.ctx || !this.music || this.muted) return;
    const t = this.ctx.currentTime;
    if (this.nextAt === 0) this.nextAt = t + 0.05;
    while (this.nextAt < t + 0.25) {
      this.schedule(this.nextAt, LEAD[this.step % LEAD.length], 0.16, "square", 0.16);
      if (this.step % 2 === 0) this.schedule(this.nextAt, BASS[(this.step / 2) % BASS.length | 0], 0.28, "triangle", 0.2);
      this.nextAt += 0.2;
      this.step += 1;
    }
  }

  private schedule(when: number, freq: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.music) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(this.music);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }
}
