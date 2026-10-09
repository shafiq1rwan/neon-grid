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
  spawn(type: EnemyType, hpScale: number, lane: number): void;
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
  ) {}

  get total(): number {
    return this.waves.length;
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
    const def = this.waves[i];
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
        this.callbacks.spawn(run.group.type, def.hpScale, Math.min(lane, this.laneCount - 1));
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
        this.countdown = WAVE_TIMING.betweenWaves;
        this.countdownMax = WAVE_TIMING.betweenWaves;
      }
    }
  }
}
