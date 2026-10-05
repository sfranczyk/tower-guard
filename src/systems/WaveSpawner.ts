import type { EnemyType } from '../types';

/** Spawns a wave's enemies one by one on timers; dispose() cancels everything still pending. */
export class WaveSpawner {
  private timers: number[] = [];

  public constructor(private readonly spawn: (type: EnemyType) => void) {}

  /** Spawns `order[i]` after `startDelayMs + i * intervalMs`. */
  public schedule(order: readonly EnemyType[], intervalMs: number, startDelayMs = 0): void {
    order.forEach((type, index) => {
      this.timers.push(window.setTimeout(() => this.spawn(type), startDelayMs + index * intervalMs));
    });
  }

  public dispose(): void {
    this.timers.forEach((timerId) => window.clearTimeout(timerId));
    this.timers = [];
  }
}
