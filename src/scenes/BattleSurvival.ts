import { viewWidth } from '../core/viewport';
import type { SurvivalLevel } from '../data/sandbox';
import type { Background } from '../rendering/Background';
import type { Foe } from '../systems/CombatSystem';

/**
 * A survival level (`sandbox.mode` survival): the clock running down the level's time, the night moving on with it
 * (Background.night on `nightCycle` maps: moon, dawn, sunrise) and the end: once the time is up, every enemy still on
 * the field flees (`flee`) and the level is won. The host's (or solo's) clock runs here; a co-op guest's follows the
 * host's snapshots (`sync`). Waves: systems/survivalWaves.ts via BattleEnemies.
 */
export class BattleSurvival {
  public readonly durationMs: number;
  private remaining: number;

  public constructor(level: SurvivalLevel, private readonly background: Background) {
    this.durationMs = level.minutes * 60_000;
    this.remaining = this.durationMs;
  }

  public get remainingMs(): number {
    return this.remaining;
  }

  public get timeUp(): boolean {
    return this.remaining <= 0;
  }

  /** How far through the night (0..1). */
  public get progress(): number {
    return 1 - this.remaining / this.durationMs;
  }

  /** `running`: the level is still on (the clock stops when it ends); the sky follows the camera at `viewLeft`. */
  public update(deltaMs: number, viewLeft: number, running: boolean, guest: boolean): void {
    if (running && !guest) {
      this.remaining = Math.max(0, this.remaining - deltaMs);
    }
    this.background.night?.show(this.progress, viewLeft, viewWidth());
  }

  /** Co-op guest: the host's clock. */
  public sync(remainingMs: number): void {
    this.remaining = Math.max(0, Math.min(this.durationMs, remainingMs));
  }

  /** Debug (`scene.survival.skip(ms)` in the ?debug console): jumps the clock ahead. */
  public skip(ms: number): void {
    this.remaining = Math.max(0, this.remaining - ms);
  }

  /** Dawn: everyone still standing runs off the field. */
  public static fleeAll(enemies: readonly Foe[]): void {
    enemies.filter((enemy) => enemy.isAlive()).forEach((enemy) => enemy.flee());
  }
}
