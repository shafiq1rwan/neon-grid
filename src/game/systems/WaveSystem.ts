import { ECONOMY, WAVE_TIMING } from '../config';
import type { EnemyType } from '../data/enemies';
import { waveEnemyCount, type WaveDef, type WaveGroup } from '../data/waves';

export type WaveState = 'prewave' | 'spawning' | 'waiting' | 'complete';

interface GroupRun {
  group: WaveGroup;
  spawned: number;
  timer: number;
}

export interface WaveCallbacks {
  /** `rewardMult` < 1 for machines in densified groups (same credits per wave). */
  spawn(type: EnemyType, hpScale: number, lane: number, rewardMult: number): void;
  waveStarted(index: number): void;
  waveSpawned(index: number, def: WaveDef): void;
}

export class WaveSystem {
  state: WaveState = 'prewave';
  /** Index of the current / last started wave (-1 before the first). */
  index = -1;
  countdown: number = WAVE_TIMING.firstWaveCountdown;
  countdownMax: number = WAVE_TIMING.firstWaveCountdown;
  spawned = 0;
  totalInWave = 0;
  /** Freeze the countdown (tutorial). */
  hold = false;
  private runs: GroupRun[] = [];
  private elapsed = 0;
  /** Round-robin lane for groups without a fixed lane. */
  private nextLane = 0;

  constructor(
    private readonly callbacks: WaveCallbacks,
    readonly waves: WaveDef[],
    private readonly laneCount = 1,
    /** Endless mode: builds wave `index` on demand (there is no last wave). */
    private readonly generate: ((index: number) => WaveDef) | null = null,
  ) {}

  get endless(): boolean {
    return this.generate !== null;
  }

  /** Number of waves (Infinity in endless mode). */
  get total(): number {
    return this.generate ? Number.POSITIVE_INFINITY : this.waves.length;
  }

  private waveAt(i: number): WaveDef {
    if (this.generate && !this.waves[i]) this.waves[i] = this.generate(i);
    return this.waves[i];
  }

  /** 1-based number of the wave shown in the HUD. */
  get displayNumber(): number {
    return Math.max(1, Math.min(this.total, this.index + 1));
  }

  get canCallNext(): boolean {
    return (this.state === 'prewave' || this.state === 'waiting') && this.index < this.total - 1;
  }

  get earlyBonus(): number {
    if (!this.canCallNext || this.state === 'prewave') return 0;
    return Math.floor(this.countdown) * ECONOMY.earlyCallBonusPerSecond;
  }

  /** Start the next wave immediately. Returns the early-call bonus. */
  callNext(): number {
    if (!this.canCallNext) return 0;
    const bonus = this.earlyBonus;
    this.startWave(this.index + 1);
    return bonus;
  }

  update(dt: number): void {
    switch (this.state) {
      case 'prewave':
      case 'waiting':
        if (this.hold) return;
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave(this.index + 1);
        break;
      case 'spawning':
        this.updateSpawning(dt);
        break;
      case 'complete':
        break;
    }
  }

  private startWave(i: number): void {
    if (i >= this.total) return;
    this.index = i;
    this.state = 'spawning';
    this.elapsed = 0;
    this.spawned = 0;
    const def = this.waveAt(i);
    this.totalInWave = waveEnemyCount(def);
    this.runs = def.groups.map((group) => ({ group, spawned: 0, timer: group.delay }));
    this.callbacks.waveStarted(i);
  }

  private updateSpawning(dt: number): void {
    this.elapsed += dt;
    const def = this.waves[this.index];
    let done = true;
    for (const run of this.runs) {
      if (run.spawned >= run.group.count) continue;
      done = false;
      run.timer -= dt;
      while (run.timer <= 0 && run.spawned < run.group.count) {
        let lane = run.group.lane;
        if (lane === undefined) {
          lane = this.nextLane;
          this.nextLane = (this.nextLane + 1) % this.laneCount;
        }
        const dense = run.group.hpMult !== undefined;
        this.callbacks.spawn(
          run.group.type,
          def.hpScale * (run.group.hpMult ?? 1),
          Math.min(lane, this.laneCount - 1),
          dense ? 1 / WAVE_TIMING.lightCountMult : 1,
        );
        run.spawned++;
        this.spawned++;
        run.timer += run.group.interval;
      }
    }
    if (done) {
      this.callbacks.waveSpawned(this.index, def);
      if (this.index >= this.total - 1) {
        this.state = 'complete';
      } else {
        this.state = 'waiting';
        const gap = def.gap ?? WAVE_TIMING.betweenWaves;
        this.countdown = gap;
        this.countdownMax = gap;
      }
    }
  }
}
