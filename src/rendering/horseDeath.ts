import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { thrownRider } from './dragonRiderFall';
import {
  HORSE_GROUND_Y, assembleHorsePose, legRootX, type HorseFrame, type HorseLegName, type HorsePose,
} from './horseRider';
import { riderPose } from './horseSeat';
import { drawHorsePose } from './horseSkeleton';
import { drawJointPose, type JointPose } from './stickmanPose';

/**
 * The horse killed under its rider (pure, sprite space as horseRider's, ground at HORSE_GROUND_Y), two ways:
 * - `lieDown`: it flinches with the head tossed up, the hindquarters sink, the forelegs buckle and it goes down onto its
 *   chest with the legs folded under, then rolls over onto its side, the legs stretched out and the head on the ground.
 *   The rider is thrown off backwards as the hindquarters sink (he slides off over its croup).
 * - `drop`: killed outright, it drops: a jolt, every leg gives way at once, the body falls (gathering speed) onto its
 *   side, bounces a little and the legs and head flop down. The rider tips forward over its neck.
 * Both end in the same pose, and the rider tumbles and lies on his back (in the game he gets up and fights on foot).
 */

export type HorseDeathKind = 'lieDown' | 'drop';

type Hooves = Readonly<Record<HorseLegName, Vec2>>;

/** How a segment eases into its key: smoothly, gathering speed (falling) or slowing down (a bounce). */
type Ease = 'smooth' | 'in' | 'out';

/** A key of the fall: the body's frame, and the rider's lean while he is still in the saddle. */
interface DeathKey extends Omit<HorseFrame, 'hooves' | 'swish' | 'headTilt'> {
  t: number;
  headTilt: number;
  hooves: Hooves;
  lean: number;
  /** How the segment that ends here eases (default smooth). */
  ease?: Ease;
}

interface DeathSpec {
  keys: readonly DeathKey[];
  /** When the rider is thrown off (ms after the hit), and how hard (sprite units/s; x < 0 backwards, y < 0 up). */
  riderThrow: { atMs: number; velocity: Vec2 };
}

const standingHooves = (): Hooves => ({
  nearFore: { x: legRootX('nearFore'), y: HORSE_GROUND_Y },
  farFore: { x: legRootX('farFore'), y: HORSE_GROUND_Y },
  nearHind: { x: legRootX('nearHind'), y: HORSE_GROUND_Y },
  farHind: { x: legRootX('farHind'), y: HORSE_GROUND_Y },
});

const STANDING: Omit<DeathKey, 't'> = { rise: 0, pitch: 0, nod: 0, headTilt: 0, lean: 0.03, hooves: standingHooves() };
/** On its side: flat on the ground, legs stretched out, the neck down and the head lying along the ground. */
const LYING: Omit<DeathKey, 't'> = {
  rise: -58, pitch: 0.02, nod: 1, headTilt: -1, lean: -0.15,
  hooves: { nearFore: { x: 100, y: 54 }, farFore: { x: 92, y: 52 }, nearHind: { x: -104, y: 55 }, farHind: { x: -96, y: 52 } },
};

const DEATHS: Readonly<Record<HorseDeathKind, DeathSpec>> = {
  lieDown: {
    keys: [
      { t: 0, ...STANDING },
      // Hit: it flinches up, the head tossed back.
      { t: 200, ...STANDING, rise: 3, pitch: -0.07, nod: -0.35, lean: -0.02 },
      // The hindquarters sink (nose up), the forelegs brace forward; the rider tips back.
      {
        t: 750, rise: -18, pitch: -0.25, nod: -0.1, headTilt: 0, lean: -0.15,
        hooves: { nearFore: { x: 34, y: 58 }, farFore: { x: 30, y: 58 }, nearHind: { x: -24, y: 58 }, farHind: { x: -28, y: 58 } },
      },
      // Down on its chest: the forelegs folded under (knees forward), the hind legs tucked (hocks back).
      {
        t: 1350, rise: -52, pitch: 0.04, nod: 0.3, headTilt: 0, lean: -0.15,
        hooves: { nearFore: { x: 22, y: 56 }, farFore: { x: 18, y: 55 }, nearHind: { x: -26, y: 56 }, farHind: { x: -30, y: 55 } },
      },
      { t: 2100, ...LYING },
    ],
    riderThrow: { atMs: 600, velocity: { x: -170, y: -100 } },
  },
  drop: {
    keys: [
      { t: 0, ...STANDING },
      // A jolt: the head jerks up, the body stiffens.
      { t: 110, ...STANDING, rise: 2, pitch: -0.05, nod: -0.25, lean: 0.08 },
      // Every leg gives way at once, splaying; the forehand goes first and the rider is pitched forward.
      {
        t: 380, rise: -30, pitch: 0.07, nod: 0.1, headTilt: 0, lean: 0.35, ease: 'in',
        hooves: { nearFore: { x: 40, y: 58 }, farFore: { x: 36, y: 58 }, nearHind: { x: -40, y: 58 }, farHind: { x: -44, y: 58 } },
      },
      // Slams onto its side, the legs flung out, the neck still coming down.
      {
        t: 600, rise: -60, pitch: 0.03, nod: 0.7, headTilt: -0.4, lean: 0.35, ease: 'in',
        hooves: { nearFore: { x: 95, y: 52 }, farFore: { x: 88, y: 50 }, nearHind: { x: -100, y: 52 }, farHind: { x: -92, y: 50 } },
      },
      // A little bounce: the legs flop up, the head hits the ground.
      {
        t: 740, rise: -54, pitch: 0.01, nod: 0.9, headTilt: -0.85, lean: 0.35, ease: 'out',
        hooves: { nearFore: { x: 99, y: 48 }, farFore: { x: 91, y: 47 }, nearHind: { x: -103, y: 49 }, farHind: { x: -95, y: 47 } },
      },
      { t: 950, ...LYING },
    ],
    riderThrow: { atMs: 260, velocity: { x: 260, y: -120 } },
  },
};

/** From the hit to lying still (ms). */
export const HORSE_DEATH_MS: Readonly<Record<HorseDeathKind, number>> = {
  lieDown: DEATHS.lieDown.keys[DEATHS.lieDown.keys.length - 1].t,
  drop: DEATHS.drop.keys[DEATHS.drop.keys.length - 1].t,
};

export const HORSE_DEATH_KINDS = Object.keys(DEATHS) as readonly HorseDeathKind[];

/** When (ms after the hit) the rider leaves the saddle, and whether backwards (lying down) or forwards (pitched over its neck). */
export const horseDeathThrow = (kind: HorseDeathKind): { atMs: number; forward: boolean } => {
  const { atMs, velocity } = DEATHS[kind].riderThrow;
  return { atMs, forward: velocity.x > 0 };
};

const EASES: Readonly<Record<Ease, (u: number) => number>> = {
  smooth: (u) => u * u * (3 - 2 * u),
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
};
const mix = (a: number, b: number, u: number): number => a + (b - a) * u;
const mixPoint = (a: Vec2, b: Vec2, u: number): Vec2 => ({ x: mix(a.x, b.x, u), y: mix(a.y, b.y, u) });

/** The fall's frame and the rider's lean `timeMs` after the hit (eased between the keys). */
const keyAt = (kind: HorseDeathKind, timeMs: number): { frame: HorseFrame; lean: number } => {
  const { keys } = DEATHS[kind];
  const duration = HORSE_DEATH_MS[kind];
  const t = Math.max(0, Math.min(duration, timeMs));
  const next = Math.max(1, keys.findIndex((key) => key.t >= t));
  const from = keys[next - 1];
  const to = keys[next];
  const u = EASES[to.ease ?? 'smooth']((t - from.t) / (to.t - from.t));
  const hoof = (name: HorseLegName): Vec2 => mixPoint(from.hooves[name], to.hooves[name], u);
  // The tail lashes while it goes down, then lies still.
  const swish = Math.sin(t / 90) * 5 * Math.max(0, 1 - t / duration);
  return {
    frame: {
      rise: mix(from.rise, to.rise, u),
      pitch: mix(from.pitch, to.pitch, u),
      nod: mix(from.nod, to.nod, u),
      headTilt: mix(from.headTilt, to.headTilt, u),
      swish,
      hooves: { nearFore: hoof('nearFore'), farFore: hoof('farFore'), nearHind: hoof('nearHind'), farHind: hoof('farHind') },
    },
    lean: mix(from.lean, to.lean, u),
  };
};

/** The horse (with its rider in the saddle) `timeMs` after the hit. */
const fallingHorse = (kind: HorseDeathKind, timeMs: number): HorsePose => {
  const { frame, lean } = keyAt(kind, timeMs);
  return assembleHorsePose(frame, ({ saddle, stirrup, mouth }) => riderPose(saddle, stirrup, mouth, lean, 0, 'stand'));
};

export interface HorseDeath {
  /** The horse; its `rider` is only meaningful while `riderThrown` is false. */
  horse: HorsePose;
  /** The rider: in the saddle, then thrown off. */
  rider: JointPose;
  riderThrown: boolean;
}

/** The horse's death of `kind` `timeMs` after the hit (pure; holds the last pose after HORSE_DEATH_MS). */
export const getHorseDeath = (kind: HorseDeathKind, timeMs: number): HorseDeath => {
  const horse = fallingHorse(kind, timeMs);
  const { atMs, velocity } = DEATHS[kind].riderThrow;
  if (timeMs < atMs) {
    return { horse, rider: horse.rider, riderThrown: false };
  }
  const seated = fallingHorse(kind, atMs).rider;
  return { horse, rider: thrownRider(seated, timeMs - atMs, velocity).pose, riderThrown: true };
};

/** Draws the horse's death (skeleton look) `timeMs` after the hit into `sprite` (cleared first). */
export const drawHorseDeath = (sprite: Graphics, kind: HorseDeathKind, timeMs: number): void => {
  const { horse, rider, riderThrown } = getHorseDeath(kind, timeMs);
  drawHorsePose(sprite, horse, riderThrown);
  if (riderThrown) {
    drawJointPose(sprite, rider, 0, { append: true });
  }
};
