import type { Graphics } from 'pixi.js';
import type { AttackStyle } from '../rendering/attackSwing';
import { DRAGON_DEATH_MS, drawDragonDeath, type DragonDeathKind } from '../rendering/dragonDeath';
import { drawStickman } from '../rendering/stickman';
import { FallClock, GibReplay, RUN_PHASE_MS, WALK_PHASE_MS } from './labSequences';

/** The animation lab's building blocks: the clock every row draws from, the row types and shared framings (labRows.ts). */

/** What every row draws from: one clock for the loops plus the one-shot falls and gibs. */
export class LabClock {
  public timeMs = 0;
  public readonly falls = new FallClock();
  public readonly gibs = new GibReplay();

  public update(deltaMs: number): void {
    this.timeMs += deltaMs;
    this.falls.update(deltaMs);
    this.gibs.update(deltaMs);
  }

  public get walkPhase(): number {
    return this.timeMs / WALK_PHASE_MS;
  }

  public get runPhase(): number {
    return this.timeMs / RUN_PHASE_MS;
  }

  /** Club swings: one every ~1.1 s, straight after each other. */
  public get swingPhase(): number {
    return this.timeMs / 180;
  }
}

export interface LabRow {
  /** Stable id used in the URL (?lab=<id>). */
  id: string;
  title: string;
  description: string;
  /** Draws the current frame; `originY: 0` keeps the hip at the sprite origin. */
  render: (sprite: Graphics, clock: LabClock) => void;
  /** Shifts the figure right (unscaled units) for animations that travel left, so they stay centred. */
  offsetX?: number;
  /** Flying animations get no ground line. */
  flying?: boolean;
  /** Dragons are drawn over the sky (the dark one disappears on the slate the skeleton needs). */
  sky?: boolean;
  /** Scale overrides for animations that spread wide (default: the lab's preview and zoom scales). */
  previewScale?: number;
  zoomScale?: number;
}

export interface LabCategory {
  /** Also accepted in the URL (?lab=<category id>) to open its tab. */
  id: string;
  tab: string;
  intro: string;
  rows: LabRow[];
}

/** Dragons are drawn smaller to fit their wings. */
export const DRAGON = { flying: true, sky: true, previewScale: 0.17, zoomScale: 1.15, offsetX: 25 } as const;
export const DRAGON_DEATH = { sky: true, previewScale: 0.12, zoomScale: 1, offsetX: 85 } as const;
export const DRAGON_DEATH_PAUSE_MS = 1200;
/** The horse and rider stand twice as tall as a stickman: drawn smaller, centred on the horse. */
export const HORSE = { previewScale: 0.25, zoomScale: 1.45, offsetX: -12 } as const;
/** The dead horse lies stretched out, its rider slid off behind it. */
export const HORSE_DEATH = { previewScale: 0.2, zoomScale: 1.4, offsetX: 6 } as const;
/** The dropping horse tips its rider forward over its neck. */
export const HORSE_DROP = { previewScale: 0.19, zoomScale: 1.3, offsetX: -32 } as const;
export const HORSE_DEATH_PAUSE_MS = 1400;

/** Fire breath: a moment of plain flight before each breath, aimed this far (radians) below level. */
export const FIRE_BREATH_PAUSE_MS = 1200;
export const FIRE_BREATH_AIM = 0.55;

/** Bow: raise, draw, loose, every ~1.4 s. */
export const BOW_CYCLE_MS = 1400;

/** Zombie grab: a bit slower than the club swings, with a pause in the stance between grabs. */
export const zombieGrabPhase = (timeMs: number): number => {
  const cycle = (timeMs % 2200) / 1500;
  return cycle >= 1 ? 0 : Math.max(0.001, cycle * Math.PI * 2);
};

/** Burning: catches fire, burns for a while, burns out, a pause, again. */
export const BURN = { catchMs: 250, burnMs: 3000, fadeMs: 700, pauseMs: 900 };
export const burnIntensity = (timeMs: number): number => {
  const { catchMs, burnMs, fadeMs, pauseMs } = BURN;
  const t = timeMs % (catchMs + burnMs + fadeMs + pauseMs);
  if (t < catchMs) {
    return t / catchMs;
  }
  return t < catchMs + burnMs ? 1 : Math.max(0, 1 - (t - catchMs - burnMs) / fadeMs);
};

/** The manoeuvre row's loop: [ms, wing beat speed, glide, nose-down pitch] per stage (hover, climb, dive, brake). */
export const MANOEUVRE_STAGES: ReadonlyArray<readonly [number, number, number, number]> = [
  [1500, 1, 0, 0], [1500, 1.8, 0, -0.2], [1500, 0.6, 1, 0.25], [900, 1.5, 0, -0.18],
];
export const MANOEUVRE_LOOP_MS = MANOEUVRE_STAGES.reduce((sum, [ms]) => sum + ms, 0);

/** The wing clock (beats run at each stage's speed), glide and pitch at `timeMs`, eased over a stage's first 400 ms. */
export const manoeuvreLoop = (timeMs: number): { wingMs: number; glide: number; pitch: number } => {
  const loops = Math.floor(timeMs / MANOEUVRE_LOOP_MS);
  let left = timeMs - loops * MANOEUVRE_LOOP_MS;
  let wingMs = loops * MANOEUVRE_STAGES.reduce((sum, [ms, flap]) => sum + ms * flap, 0);
  for (let index = 0; ; index += 1) {
    const [ms, flap, glide, pitch] = MANOEUVRE_STAGES[index];
    if (left < ms || index === MANOEUVRE_STAGES.length - 1) {
      const [, , glideBefore, pitchBefore] = MANOEUVRE_STAGES[(index + MANOEUVRE_STAGES.length - 1) % MANOEUVRE_STAGES.length];
      const ease = Math.min(1, left / 400);
      return { wingMs: wingMs + left * flap, glide: glideBefore + (glide - glideBefore) * ease, pitch: pitchBefore + (pitch - pitchBefore) * ease };
    }
    wingMs += ms * flap;
    left -= ms;
  }
};

export const dragonDeath = (kind: DragonDeathKind) => (sprite: Graphics, clock: LabClock): void => {
  drawDragonDeath(sprite, clock.timeMs % (DRAGON_DEATH_MS + DRAGON_DEATH_PAUSE_MS), kind);
};

export const swing = (attackStyle: AttackStyle) => (sprite: Graphics, clock: LabClock): void => {
  drawStickman(sprite, 0, { idleBlend: 1, armed: true, attackStyle, attackPhase: clock.swingPhase, originY: 0 });
};
