import type { IWave } from '../types';

/** Schedules wave spawns on timers; dispose() cancels everything still pending. */
export class WaveSpawner {
  private timers: number[] = [];

  public constructor(private readonly spawn: (wave: IWave) => void) {}

  public schedule(waves: readonly IWave[]): void {
    waves.forEach((wave) => {
      this.setTimer(() => {
        for (let index = 0; index < wave.count; index += 1) {
          this.setTimer(() => this.spawn(wave), index * wave.spawn.interval);
        }
      }, wave.delay);
    });
  }

  public dispose(): void {
    this.timers.forEach((timerId) => window.clearTimeout(timerId));
    this.timers = [];
  }

  private setTimer(callback: () => void, delayMs: number): void {
    this.timers.push(window.setTimeout(callback, delayMs));
  }
}
