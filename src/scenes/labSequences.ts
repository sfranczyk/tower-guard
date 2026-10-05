import type { Graphics } from 'pixi.js';
import { drawStickman } from '../rendering/stickman';
import { FALL_DURATION_MS, drawStickmanFall, type FallKind } from '../rendering/stickmanFall';

/** Scripted animation sequences shown in the animation lab. Each has update(deltaMs) and render(sprite). */

export const WALK_PHASE_MS = 150;
export const RUN_PHASE_MS = 110;
const IDLE_BLEND_MS = 350;
const RUN_BLEND_MS = 400;

/** Number of full steps (half walk cycles) completed between two phases. */
const stepsBetween = (previousPhase: number, phase: number): number =>
  Math.max(0, Math.floor(phase / Math.PI) - Math.floor(previousPhase / Math.PI));

/** Walks 5 steps, then blends into standing for 3 seconds, and repeats. */
export class PausingWalk {
  public phase = 0;
  public idleBlend = 0;
  private stepsSinceStand = 0;
  private idleRemainingMs = 0;

  public update(deltaMs: number): void {
    if (this.idleRemainingMs > 0) {
      this.idleRemainingMs = Math.max(0, this.idleRemainingMs - deltaMs);
      this.idleBlend = Math.min(1, this.idleBlend + deltaMs / IDLE_BLEND_MS);
      if (this.idleRemainingMs === 0) {
        this.stepsSinceStand = 0;
      }
      return;
    }
    const previousPhase = this.phase;
    this.phase += deltaMs / WALK_PHASE_MS;
    this.stepsSinceStand += stepsBetween(previousPhase, this.phase);
    this.idleBlend = Math.max(0, this.idleBlend - deltaMs / IDLE_BLEND_MS);
    if (this.stepsSinceStand >= 5) {
      this.idleRemainingMs = 3_000;
    }
  }
}

type WalkRunState = 'walkFirst' | 'stand' | 'walkSecond' | 'run' | 'runToWalk';

/** walkFirst (5 steps) → stand (2 s) → walkSecond (2 steps) → run (10 steps) → runToWalk → … */
export class WalkRunSequence {
  private state: WalkRunState = 'walkFirst';
  private phase = 0;
  private runPhase = 0;
  private runBlend = 0;
  private steps = 0;
  private timerMs = 0;
  private idleBlend = 0;

  public update(deltaMs: number): void {
    switch (this.state) {
      case 'stand':
        this.timerMs = Math.max(0, this.timerMs - deltaMs);
        this.idleBlend = Math.min(1, this.idleBlend + deltaMs / IDLE_BLEND_MS);
        if (this.timerMs === 0) {
          this.state = 'walkSecond';
          this.steps = 0;
        }
        return;

      case 'run': {
        const previousPhase = this.runPhase;
        this.runPhase += deltaMs / RUN_PHASE_MS;
        this.runBlend = Math.min(1, this.runBlend + deltaMs / RUN_BLEND_MS);
        this.steps += stepsBetween(previousPhase, this.runPhase);
        if (this.steps >= 10) {
          this.state = 'runToWalk';
          this.phase = this.runPhase;
          this.steps = 0;
          this.idleBlend = 0;
        }
        return;
      }

      case 'runToWalk':
        this.phase += deltaMs / WALK_PHASE_MS;
        this.runBlend = Math.max(0, this.runBlend - deltaMs / RUN_BLEND_MS);
        if (this.runBlend === 0) {
          this.state = 'walkFirst';
          this.steps = 0;
          this.runPhase = 0;
        }
        return;

      case 'walkFirst':
      case 'walkSecond': {
        const previousPhase = this.phase;
        this.phase += deltaMs / WALK_PHASE_MS;
        this.steps += stepsBetween(previousPhase, this.phase);
        this.idleBlend = Math.max(0, this.idleBlend - deltaMs / IDLE_BLEND_MS);
        const targetSteps = this.state === 'walkFirst' ? 5 : 2;
        if (this.steps < targetSteps) {
          return;
        }
        if (this.state === 'walkFirst') {
          this.state = 'stand';
          this.timerMs = 2_000;
        } else {
          this.state = 'run';
          this.runPhase = this.phase;
          this.runBlend = 0;
          this.steps = 0;
        }
      }
    }
  }

  public render(sprite: Graphics): void {
    if (this.state === 'run') {
      drawStickman(sprite, this.runPhase, { runningBlend: this.runBlend, originY: 0 });
    } else if (this.state === 'runToWalk') {
      drawStickman(sprite, this.phase, { runningBlend: this.runBlend, originY: 0 });
    } else {
      drawStickman(sprite, this.phase, { idleBlend: this.idleBlend, originY: 0 });
    }
  }
}

type ArcherState =
  | 'walkLowered' | 'stopLowered' | 'raise' | 'draw' | 'walkDrawn' | 'stopDrawn' | 'release' | 'lower' | 'hold';

const ARCHER_STOP_MS = 400;
const ARCHER_RAISE_MS = 350;
const ARCHER_DRAW_MS = 500;
const ARCHER_RELEASE_MS = 300;
const ARCHER_LOWER_MS = 450;
const ARCHER_HOLD_MS = 700;
const ARCHER_TENSION = 0.85;
const ARCHER_STEPS = 4;

/**
 * Walk with the bow lowered, stop, raise and draw, walk drawn, stop, release, lower, hold, repeat.
 */
export class ArcherReadySequence {
  private state: ArcherState = 'walkLowered';
  private timeMs = 0;
  private phase = 0;
  private steps = 0;
  private idle = 0;
  private ready = 0;
  private tension = 0;

  public update(deltaMs: number): void {
    this.timeMs += deltaMs;
    const walking = this.state === 'walkLowered' || this.state === 'walkDrawn';
    if (walking) {
      const previousPhase = this.phase;
      this.phase += deltaMs / WALK_PHASE_MS;
      this.steps += stepsBetween(previousPhase, this.phase);
      this.idle = Math.max(0, this.idle - deltaMs / IDLE_BLEND_MS);
    } else {
      this.idle = Math.min(1, this.idle + deltaMs / IDLE_BLEND_MS);
    }
    const progress = (duration: number): number => Math.min(1, this.timeMs / duration);

    switch (this.state) {
      case 'walkLowered':
        if (this.steps >= ARCHER_STEPS) this.next('stopLowered');
        break;
      case 'stopLowered':
        if (this.timeMs >= ARCHER_STOP_MS) this.next('raise');
        break;
      case 'raise':
        this.ready = progress(ARCHER_RAISE_MS);
        if (this.ready >= 1) this.next('draw');
        break;
      case 'draw':
        this.tension = ARCHER_TENSION * progress(ARCHER_DRAW_MS);
        if (this.timeMs >= ARCHER_DRAW_MS) this.next('walkDrawn');
        break;
      case 'walkDrawn':
        if (this.steps >= ARCHER_STEPS) this.next('stopDrawn');
        break;
      case 'stopDrawn':
        if (this.timeMs >= ARCHER_STOP_MS) this.next('release');
        break;
      case 'release':
        this.tension = ARCHER_TENSION * (1 - progress(ARCHER_RELEASE_MS));
        if (this.timeMs >= ARCHER_RELEASE_MS) this.next('lower');
        break;
      case 'lower':
        this.ready = 1 - progress(ARCHER_LOWER_MS);
        if (this.timeMs >= ARCHER_LOWER_MS) this.next('hold');
        break;
      case 'hold':
        if (this.timeMs >= ARCHER_HOLD_MS) this.next('walkLowered');
        break;
    }
  }

  public render(sprite: Graphics): void {
    drawStickman(sprite, this.phase, {
      idleBlend: this.idle,
      archerPose: true,
      bowReady: this.ready,
      bowTension: this.tension,
      skin: 'armored',
      originY: 0,
    });
  }

  private next(state: ArcherState): void {
    this.state = state;
    this.timeMs = 0;
    this.steps = 0;
  }
}

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
