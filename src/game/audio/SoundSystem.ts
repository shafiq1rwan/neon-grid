/**
 * Tiny Web Audio synthesiser. All sound effects are generated procedurally,
 * so there are no audio files to download. The AudioContext is only created
 * after a user gesture (browser autoplay policy).
 */

export type SfxName =
  | 'click'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'pulse'
  | 'cannon'
  | 'missile'
  | 'explosion'
  | 'tesla'
  | 'laser'
  | 'charge'
  | 'kill'
  | 'bigKill'
  | 'shieldBreak'
  | 'leak'
  | 'waveStart'
  | 'waveClear'
  | 'error'
  | 'victory'
  | 'defeat'
  | 'coin'
  | 'frost'
  | 'hackLock'
  | 'hack'
  | 'hackPerfect'
  | 'hackBlast'
  | 'hackCharge'
  | 'hackDeny'
  | 'heal'
  | 'burrow';

/** Minimum milliseconds between two plays of the same sound. */
const THROTTLE: Partial<Record<SfxName, number>> = {
  pulse: 55,
  cannon: 70,
  missile: 70,
  explosion: 60,
  tesla: 80,
  laser: 120,
  charge: 150,
  heal: 250,
  burrow: 160,
  kill: 45,
  shieldBreak: 80,
  coin: 60,
  frost: 90,
  hackBlast: 70,
  hackCharge: 120,
};

class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private suspendedByHost = false;
  private readonly last = new Map<SfxName, number>();
  private voices = 0;

  /** Call from a user gesture to create / resume the audio context. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === 'suspended' && !this.suspendedByHost) void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Suspend audio while an ad plays or the tab is hidden. */
  suspend(): void {
    this.suspendedByHost = true;
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    this.suspendedByHost = false;
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap !== undefined) {
      const prev = this.last.get(name) ?? 0;
      if (now - prev < gap) return;
    }
    if (this.voices > 24) return;
    this.last.set(name, now);
    const t = ctx.currentTime + 0.005;

    switch (name) {
      case 'click':
        this.tone('square', 1200, 900, t, 0.04, 0.08);
        break;
      case 'place':
        this.noiseBurst(t, 0.12, 400, 'lowpass', 0.35);
        this.tone('square', 220, 440, t, 0.08, 0.12);
        this.tone('triangle', 660, 880, t + 0.07, 0.1, 0.12);
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.06, 0.12, 0.14));
        this.tone('sawtooth', 200, 800, t, 0.25, 0.04);
        break;
      case 'sell':
        [784, 587, 440].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.05, 0.08, 0.12));
        break;
      case 'pulse':
        this.tone('triangle', 1400, 500, t, 0.07, 0.07);
        break;
      case 'cannon':
        this.noiseBurst(t, 0.18, 900, 'lowpass', 0.45);
        this.tone('sine', 140, 40, t, 0.22, 0.4);
        break;
      case 'missile':
        this.noiseBurst(t, 0.32, 1200, 'bandpass', 0.22, 3000);
        this.tone('sawtooth', 300, 120, t, 0.18, 0.04);
        break;
      case 'explosion':
        this.noiseBurst(t, 0.42, 700, 'lowpass', 0.5, 90);
        this.tone('sine', 90, 30, t, 0.35, 0.4);
        break;
      case 'tesla':
        this.buzz(t, 0.16);
        this.noiseBurst(t, 0.1, 3000, 'highpass', 0.12);
        break;
      case 'laser':
        this.tone('sawtooth', 880, 1320, t, 0.18, 0.05);
        this.tone('sine', 440, 660, t, 0.2, 0.08);
        break;
      case 'heal':
        // soft rising two-note chime: a machine is being repaired
        this.tone('sine', 520, 780, t, 0.16, 0.045);
        this.tone('sine', 780, 1170, t + 0.08, 0.2, 0.035);
        break;
      case 'burrow':
        // muffled dig into the ground
        this.noiseBurst(t, 0.22, 900, 'lowpass', 0.16, 160);
        this.tone('sine', 140, 60, t, 0.2, 0.06);
        break;
      case 'charge':
        this.tone('sine', 300, 900, t, 0.25, 0.05);
        break;
      case 'kill':
        this.noiseBurst(t, 0.12, 2200, 'bandpass', 0.18);
        this.tone('square', 600, 120, t, 0.1, 0.06);
        break;
      case 'bigKill':
        this.noiseBurst(t, 0.5, 600, 'lowpass', 0.55, 80);
        this.tone('sine', 120, 30, t, 0.45, 0.45);
        this.tone('square', 400, 60, t, 0.3, 0.06);
        break;
      case 'shieldBreak':
        [2200, 1700, 2600].forEach((f, i) => this.tone('triangle', f, f * 0.7, t + i * 0.025, 0.14, 0.07));
        break;
      case 'leak':
        this.tone('square', 220, 110, t, 0.22, 0.14);
        this.tone('square', 233, 116, t + 0.05, 0.22, 0.1);
        break;
      case 'waveStart':
        this.tone('sawtooth', 110, 110, t, 0.5, 0.08);
        this.tone('sawtooth', 165, 165, t + 0.12, 0.5, 0.06);
        this.tone('square', 330, 330, t + 0.24, 0.25, 0.04);
        break;
      case 'waveClear':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.085, 0.24, 0.11));
        this.tone('sine', 262, 262, t, 0.4, 0.08);
        break;
      case 'error':
        this.tone('square', 180, 140, t, 0.12, 0.08);
        break;
      case 'frost':
        this.noiseBurst(t, 0.35, 4000, 'highpass', 0.14);
        this.tone('sine', 1900, 900, t, 0.3, 0.05);
        this.tone('triangle', 2600, 2200, t + 0.04, 0.2, 0.03);
        break;
      case 'hackLock':
        // rising scan sweep while the ring closes
        this.tone('sine', 300, 1500, t, 0.8, 0.05);
        this.tone('square', 600, 3000, t, 0.8, 0.012);
        break;
      case 'hack':
        // quick data chirps
        [1400, 900, 1800, 1200, 2200].forEach((f, i) => this.tone('square', f, f * 0.9, t + i * 0.035, 0.05, 0.035));
        this.tone('sine', 220, 660, t, 0.2, 0.06);
        break;
      case 'hackPerfect':
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.045, 0.32, 0.1));
        [2600, 3200, 2900].forEach((f, i) => this.tone('square', f, f * 0.95, t + 0.02 + i * 0.03, 0.05, 0.03));
        this.noiseBurst(t, 0.25, 5000, 'highpass', 0.1);
        break;
      case 'hackBlast':
        this.noiseBurst(t, 0.45, 900, 'lowpass', 0.5, 90);
        this.tone('sine', 140, 35, t, 0.4, 0.4);
        // digital crunch on top of the boom
        this.tone('square', 1200, 80, t, 0.18, 0.08);
        break;
      case 'hackCharge':
        this.tone('triangle', 1320, 1320, t, 0.1, 0.08);
        this.tone('triangle', 1980, 1980, t + 0.07, 0.16, 0.08);
        break;
      case 'hackDeny':
        this.tone('square', 320, 160, t, 0.16, 0.08);
        this.tone('square', 300, 150, t + 0.08, 0.16, 0.06);
        break;
      case 'coin':
        this.tone('triangle', 1318, 1760, t, 0.07, 0.05);
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, t + i * 0.12, 0.35, 0.15));
        this.tone('sawtooth', 262, 262, t + 0.5, 0.8, 0.04);
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, t + i * 0.18, 0.4, 0.07));
        this.noiseBurst(t, 0.8, 300, 'lowpass', 0.3, 60);
        break;
    }
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.track(osc);
  }

  private noiseBurst(
    t: number,
    dur: number,
    freq: number,
    type: BiquadFilterType,
    vol: number,
    endFreq?: number,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
    this.track(src);
  }

  /** Crackling electrical buzz (square wave with jittered pitch). */
  private buzz(t: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    for (let i = 0; i < 8; i++) {
      osc.frequency.setValueAtTime(90 + Math.random() * 400, t + (i * dur) / 8);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.track(osc);
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

export const sfx = new SoundSystem();
