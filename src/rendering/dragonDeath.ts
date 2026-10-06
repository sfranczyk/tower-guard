import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { drawBow } from './archer';
import { DRAGON_COLORS, drawDragon, getDragonPose, type DragonPose, type WingPose } from './dragon';
import { DragonGibSimulation } from './dragonGibs';
import { DEATH_GRAVITY, landingTime, thrownBow, thrownRider } from './dragonRiderFall';
import { GIB_GROUND_Y, GibSimulation, drawStickmanGibs } from './stickmanGibs';
import { drawJointPose, type JointPose } from './stickmanPose';

/**
 * Dragon deaths (lab previews), in the dragon's sprite space with the ground at GIB_GROUND_Y:
 * - fall: the rider is thrown off (dragonRiderFall.ts); the dragon drops, tips nose-down and lands lying
 *   flat (neck, head and tail on the ground, both wings folded down against its side);
 * - explode: dragon (dragonGibs.ts) and rider are blown apart;
 * - riderExplode: only the rider is blown apart, and the dragon falls as in `fall`.
 * Everything is a pure function of time (simulations are re-run from the hit), so it's deterministic.
 */
export type DragonDeathKind = 'fall' | 'explode' | 'riderExplode';

export const DRAGON_DEATH_MS = 2800;
/** It flies on until the hit. */
export const DRAGON_HIT_MS = 300;
/** The dragon's height above the sprite origin while flying, and where it rests (belly on the ground). */
const FLY_Y = -150;
const BELLY = 28;
export const DRAGON_LYING_Y = GIB_GROUND_Y - BELLY;
const DRAGON_DROP_SPEED = -80;
const LANDED_TILT = 0.03;
const NOSE_DOWN = 0.5;

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpPoint = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

export interface DragonFall {
  /** Height of the dragon's origin. */
  y: number;
  /** Nose-down tilt. */
  rotation: number;
  /** 0 = as it was hit, 1 = settled flat on the ground. */
  lying: number;
}

/** The dragon dropping out of the sky after the hit and settling flat. */
export const dragonFallState = (timeMs: number): DragonFall => {
  if (timeMs <= DRAGON_HIT_MS) {
    return { y: FLY_Y, rotation: 0, lying: 0 };
  }
  const t = (timeMs - DRAGON_HIT_MS) / 1000;
  const land = landingTime(FLY_Y, DRAGON_DROP_SPEED, DRAGON_LYING_Y);
  if (t < land) {
    return { y: FLY_Y + DRAGON_DROP_SPEED * t + (DEATH_GRAVITY * t * t) / 2, rotation: Math.min(NOSE_DOWN, t * 1.2), lying: 0 };
  }
  const since = (t - land) * 1000;
  const tiltAtLanding = Math.min(NOSE_DOWN, land * 1.2);
  return { y: DRAGON_LYING_Y, rotation: lerp(tiltAtLanding, LANDED_TILT, smooth(since / 250)), lying: smooth(since / 350) };
};

/**
 * The pose `base` blended towards lying flat: neck, head and tail on the ground, no bob. The near wing
 * drapes down over the flank to the ground; the far wing folds down behind the body, out of sight.
 */
export const lyingDragonPose = (base: DragonPose, amount: number): DragonPose => {
  const t = amount;
  const neckTarget = base.neck.map((_, index) => ({ x: 40 + index * 12, y: -4 + index * 4.4 }));
  const tailTarget = base.tail.map((_, index) => {
    const along = index / (base.tail.length - 1);
    return { x: -150 + along * 120, y: BELLY - 6 - along * 12 };
  });
  const blendWing = (wing: WingPose, target: Omit<WingPose, 'shoulder'>): WingPose => ({
    shoulder: wing.shoulder,
    wrist: lerpPoint(wing.wrist, target.wrist, t),
    tip: lerpPoint(wing.tip, target.tip, t),
    trail: wing.trail.map((point, index) => lerpPoint(point, target.trail[index], t)),
  });
  const near = base.nearWing.shoulder;
  const far = base.farWing.shoulder;
  const nearWing = blendWing(base.nearWing, {
    wrist: { x: near.x - 34, y: near.y - 12 },
    tip: { x: near.x - 112, y: BELLY - 3 },
    trail: [{ x: near.x - 84, y: BELLY - 1 }, { x: near.x - 52, y: BELLY - 6 }, { x: near.x - 20, y: near.y + 18 }],
  });
  // Folded flat along the far side, inside the body's silhouette (drawn before the body, so hidden).
  const farWing = blendWing(base.farWing, {
    wrist: { x: far.x - 26, y: far.y + 6 },
    tip: { x: far.x - 78, y: BELLY - 14 },
    trail: [{ x: far.x - 64, y: BELLY - 10 }, { x: far.x - 46, y: far.y + 22 }, { x: far.x - 22, y: far.y + 18 }],
  });
  const neck = base.neck.map((point, index) => lerpPoint(point, neckTarget[index], t));
  return {
    ...base,
    bob: lerp(base.bob, 0, t),
    neck,
    head: neck[neck.length - 1],
    headTilt: lerp(base.headTilt, 0.12, t),
    tail: base.tail.map((point, index) => lerpPoint(point, tailTarget[index], t)),
    nearWing,
    farWing,
  };
};

/** Draws with a rotation about (0, 0) followed by a translation (the sprite's local transform for a part). */
const place = (g: Graphics, rotation: number, x: number, y: number): void => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  g.setTransform(cos, sin, -sin, cos, x, y);
};

/** A quick orange flash where something exploded. */
const drawFlash = (g: Graphics, at: Vec2, sinceMs: number, size: number): void => {
  if (sinceMs > 220) {
    return;
  }
  const t = sinceMs / 220;
  g.circle(at.x, at.y, size * (0.6 + t)).fill({ color: 0xffd27a, alpha: 0.8 * (1 - t) });
  g.circle(at.x, at.y, size * 0.5 * (0.6 + t)).fill({ color: 0xfff3c4, alpha: 0.9 * (1 - t) });
};

const lifted = (point: Vec2): Vec2 => ({ x: point.x, y: point.y + FLY_Y });

/** The rider's pose at the hit in sprite space (the dragon flies at FLY_Y). */
const seatedRider = (pose: DragonPose): JointPose => {
  const rider = { ...pose.rider };
  (['hip', 'shoulder', 'neckTop', 'head', 'frontKnee', 'frontFoot', 'rearKnee', 'rearFoot', 'frontElbow', 'frontHand', 'rearElbow', 'rearHand'] as const)
    .forEach((key) => { rider[key] = lifted(pose.rider[key]); });
  return rider;
};

const drawRiderGibs = (g: Graphics, pose: DragonPose, sinceMs: number): void => {
  const simulation = new GibSimulation({ x: 4, y: -20 }, 7, 1.2, -(FLY_Y + pose.rider.hip.y));
  simulation.step(sinceMs);
  place(g, 0, pose.rider.hip.x, 0);
  drawStickmanGibs(g, simulation, 0, true);
  g.resetTransform();
};

const drawThrownRider = (g: Graphics, pose: DragonPose, sinceMs: number): void => {
  if (pose.bow) {
    const rig = pose.bow.rig;
    const bow = thrownBow({ ...rig, bowTop: lifted(rig.bowTop), bowBottom: lifted(rig.bowBottom), bowControl: lifted(rig.bowControl) }, sinceMs);
    const nock = { x: (bow.bowTop.x + bow.bowBottom.x) / 2, y: (bow.bowTop.y + bow.bowBottom.y) / 2 };
    drawBow(g, { ...rig, ...bow, stringNock: nock });
  }
  drawJointPose(g, thrownRider(seatedRider(pose), sinceMs).pose, 0, { append: true });
};

/** Draws a dragon death at `timeMs` (0 = still flying, the hit comes at DRAGON_HIT_MS). */
export const drawDragonDeath = (g: Graphics, timeMs: number, kind: DragonDeathKind): void => {
  g.clear();
  const time = Math.max(0, Math.min(DRAGON_DEATH_MS, timeMs));
  const hitPose = getDragonPose(DRAGON_HIT_MS, 'archer');
  if (time < DRAGON_HIT_MS) {
    place(g, 0, 0, FLY_Y);
    drawDragon(g, getDragonPose(time, 'archer'), true);
    g.resetTransform();
    return;
  }
  const since = time - DRAGON_HIT_MS;

  if (kind === 'explode') {
    const simulation = new DragonGibSimulation(hitPose, FLY_Y);
    simulation.step(since);
    simulation.pieces.forEach((piece) => {
      g.poly(DragonGibSimulation.outlineOf(piece).flatMap((point) => [point.x, point.y]))
        .fill({ color: piece.color })
        .stroke({ width: 1.5, color: DRAGON_COLORS.bone, join: 'round' });
    });
    drawRiderGibs(g, hitPose, since);
    drawFlash(g, { x: 0, y: FLY_Y }, since, 70);
    return;
  }

  // The dragon falls and settles flat (wings frozen from the moment it was hit).
  const fall = dragonFallState(time);
  place(g, fall.rotation, 0, fall.y);
  drawDragon(g, lyingDragonPose(hitPose, fall.lying), false);
  g.resetTransform();

  if (kind === 'fall') {
    drawThrownRider(g, hitPose, since);
    return;
  }
  drawRiderGibs(g, hitPose, since);
  drawFlash(g, lifted({ x: hitPose.rider.hip.x, y: hitPose.rider.hip.y - 20 }), since, 30);
};
