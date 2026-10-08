import type { Graphics } from 'pixi.js';
import { FALL_DURATION_MS, drawStickmanFall, type FallKind } from '../rendering/stickmanFall';
import { GibSimulation, drawStickmanGibs } from '../rendering/stickmanGibs';

/** The animation lab's one-shot animations (falls, gibs) on a loop. Each has update(deltaMs) and render(sprite). */

/** Walk and run cycle speed in the lab (ms per radian of phase). */
export const WALK_PHASE_MS = 150;
export const RUN_PHASE_MS = 110;

/** Fall animations hold their final pose this long before replaying. */
const FALL_HOLD_MS = 1200;
/** Time spent lying on the ground between the knockback and getting up. */
const KNOCKDOWN_LIE_MS = 400;
/** Time spent standing after getting up, before the knockback replays. */
const STAND_HOLD_MS = 700;

/** Shared clock for the one-shot fall animations. */
export class FallClock {
  private timeMs = 0;

  public update(deltaMs: number): void {
    this.timeMs += deltaMs;
  }

  /** Plays one fall, holds the last pose, then replays. */
  public render(sprite: Graphics, kind: FallKind): void {
    const duration = FALL_DURATION_MS[kind];
    drawStickmanFall(sprite, kind, Math.min(1, (this.timeMs % (duration + FALL_HOLD_MS)) / duration));
  }

  /** Knockback, a short pause on the ground, getting up, a moment standing, then replays. */
  public renderKnockbackGetUp(sprite: Graphics): void {
    const knockback = FALL_DURATION_MS.knockback;
    const getUp = FALL_DURATION_MS.getUp;
    const time = this.timeMs % (knockback + KNOCKDOWN_LIE_MS + getUp + STAND_HOLD_MS);
    if (time < knockback + KNOCKDOWN_LIE_MS) {
      drawStickmanFall(sprite, 'knockback', Math.min(1, time / knockback));
    } else {
      drawStickmanFall(sprite, 'getUp', Math.min(1, (time - knockback - KNOCKDOWN_LIE_MS) / getUp));
    }
  }
}

/** Pause on the standing figure before it blows apart, and how long the pieces stay before replaying. */
const GIB_WAIT_MS = 500;
const GIB_REPLAY_MS = 3200;

/** Stands for a moment, blows apart, lets the pieces settle, then replays with a new random seed. */
export class GibReplay {
  private simulation = new GibSimulation(undefined, 1);
  private timeMs = 0;
  private seed = 1;

  public update(deltaMs: number): void {
    this.timeMs += deltaMs;
    if (this.timeMs > GIB_WAIT_MS) {
      this.simulation.step(deltaMs);
    }
    if (this.timeMs > GIB_WAIT_MS + GIB_REPLAY_MS) {
      this.seed += 1;
      this.simulation = new GibSimulation(undefined, this.seed);
      this.timeMs = 0;
    }
  }

  public render(sprite: Graphics): void {
    if (this.timeMs <= GIB_WAIT_MS) {
      drawStickmanFall(sprite, 'death', 0);
      return;
    }
    drawStickmanGibs(sprite, this.simulation);
  }
}
