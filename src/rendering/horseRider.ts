import type { Vec2 } from '../types';
import { rotateAbout as rotate } from '../utils/math';
import { solveJoint } from './designs/designSkeleton';
import { riderPose, smooth, type LanceHold, type LancePose } from './horseSeat';
import type { JointPose } from './stickmanPose';

/**
 * A stickman riding a horse (pure poses, tested; the animation lab draws them in the skeleton look, the mounted knight
 * in the game in its own, rendering/designs/warhorse.ts): side view facing +x, hooves on the ground at HORSE_GROUND_Y
 * like the stickman's feet, and the rider sitting astride, feet in the stirrups and both hands on the reins, or the
 * near one on a lance (`LanceHold`, horseSeat.ts). Three gaits: standing (breathing), a four-beat walk and a gallop with a moment of
 * suspension, the body rocking and the head nodding with it. The horse moves on the spot (the lab doesn't scroll), so
 * planted hooves slide back at `gaitGroundSpeed`: the game moves it that fast, so they stay put. Hit zones are in
 * horseHitZones.ts, the skeleton drawing in horseSkeleton.ts.
 */

export const HORSE_GROUND_Y = 58;

export type HorseGait = 'stand' | 'walk' | 'gallop';

/** Leg lengths: upper (to the knee or hock) and lower (cannon and pastern to the hoof). */
export const HORSE_LEG = { upper: 38, lower: 40 } as const;

interface GaitSpec {
  cycleMs: number;
  /** Half the distance a planted hoof slides back. */
  stride: number;
  lift: number;
  /** Share of the cycle each hoof is on the ground. */
  stance: number;
  /** When each hoof lands (fraction of the cycle): near hind, far hind, near fore, far fore. */
  landings: { nearHind: number; farHind: number; nearFore: number; farFore: number };
  /** Body rise and fall (px), pitch (radians, + = nose down) and head nod (radians). */
  bob: number;
  pitch: number;
  nod: number;
  /** The rider leans forward this far (radians). */
  lean: number;
}

const GAITS: Readonly<Record<HorseGait, GaitSpec>> = {
  // All four hooves planted; it breathes and shakes its head a little.
  stand: {
    cycleMs: 2600, stride: 0, lift: 0, stance: 1,
    landings: { nearHind: 0, nearFore: 0, farHind: 0, farFore: 0 },
    bob: 0.8, pitch: 0.006, nod: 0.06, lean: 0.03,
  },
  // Four beats, evenly spaced: hind, fore on the same side, the other hind, the other fore.
  walk: {
    cycleMs: 1200, stride: 15, lift: 12, stance: 0.62,
    landings: { nearHind: 0, nearFore: 0.25, farHind: 0.5, farFore: 0.75 },
    bob: 1.5, pitch: 0.012, nod: 0.07, lean: 0.06,
  },
  // Hind, hind, fore, fore, then all four off the ground.
  gallop: {
    cycleMs: 620, stride: 24, lift: 24, stance: 0.32,
    landings: { farHind: 0, nearHind: 0.1, farFore: 0.3, nearFore: 0.4 },
    bob: 4, pitch: 0.05, nod: 0.16, lean: 0.32,
  },
};

/** One leg: where it hangs from the body, the knee (fore) or hock (hind), and the hoof. */
export interface HorseLeg {
  root: Vec2;
  joint: Vec2;
  hoof: Vec2;
}

export interface HorsePose {
  nearFore: HorseLeg;
  farFore: HorseLeg;
  nearHind: HorseLeg;
  farHind: HorseLeg;
  /** The barrel (an ellipse): centre, radii and tilt. */
  barrel: { centre: Vec2; rx: number; ry: number; angle: number };
  withers: Vec2;
  chest: Vec2;
  croup: Vec2;
  poll: Vec2;
  throat: Vec2;
  forehead: Vec2;
  muzzle: Vec2;
  nose: Vec2;
  chin: Vec2;
  /** Where the reins meet the bit. */
  mouth: Vec2;
  /** Tail strands from the croup. */
  tail: Vec2[];
  rider: JointPose;
  /** The rider's lance (with a LanceHold), from its butt to its point. */
  lance?: LancePose;
}

/** How fast (sprite px/ms) a planted hoof slides back in `gait`: moving the horse this fast keeps it in place. */
export const gaitGroundSpeed = (gait: HorseGait): number => {
  const { stride, stance, cycleMs } = GAITS[gait];
  return (2 * stride) / (stance * cycleMs);
};

const wrap = (p: number): number => ((p % 1) + 1) % 1;
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
/** A hoof `sinceLanding` (cycles) after it landed: planted and sliding back, then lifted and swung forward. */
const hoofAt = (sinceLanding: number, rootX: number, { stride, lift, stance }: GaitSpec): Vec2 => {
  const q = wrap(sinceLanding);
  if (q < stance) {
    return { x: rootX + stride * (1 - (2 * q) / stance), y: HORSE_GROUND_Y };
  }
  const u = (q - stance) / (1 - stance);
  return { x: rootX - stride + 2 * stride * smooth(u), y: HORSE_GROUND_Y - lift * Math.sin(Math.PI * u) };
};

/** The body's frame (before bob and pitch): the horse stands with its back at about y -38. */
const BODY = {
  centre: { x: -4, y: -20 },
  fore: { x: 26, y: -8 },
  hind: { x: -30, y: -9 },
  withers: { x: 18, y: -38 },
  chest: { x: 44, y: -14 },
  croup: { x: -40, y: -36 },
  saddle: { x: 2, y: -42 },
  stirrup: { x: 10, y: 4 },
} as const;
/** The neck and head, nodding about the withers. */
const HEAD = {
  poll: { x: 52, y: -80 },
  throat: { x: 62, y: -60 },
  forehead: { x: 60, y: -85 },
  muzzle: { x: 88, y: -62 },
  nose: { x: 87, y: -54 },
  chin: { x: 76, y: -52 },
  mouth: { x: 79, y: -55 },
} as const;

export type HorseLegName = 'nearFore' | 'farFore' | 'nearHind' | 'farHind';

/** Where each leg hangs from the body (body frame) and which way its joint bends (knees forward, hocks back). */
const LEG_ROOTS: Readonly<Record<HorseLegName, { root: Vec2; bend: 1 | -1 }>> = {
  nearFore: { root: BODY.fore, bend: 1 },
  farFore: { root: { x: BODY.fore.x - 4, y: BODY.fore.y }, bend: 1 },
  nearHind: { root: BODY.hind, bend: -1 },
  farHind: { root: { x: BODY.hind.x - 4, y: BODY.hind.y }, bend: -1 },
};

/** Where each leg's root is in the body frame (before rise and pitch), for poses that place the hooves themselves. */
export const legRootX = (leg: HorseLegName): number => LEG_ROOTS[leg].root.x;

/**
 * One frame of the horse: the body raised `rise` px (negative lowers it) and pitched `pitch` radians (+ = nose down)
 * about the barrel, the neck and head nodded `nod` (+ = down) about the withers, the head tilted `headTilt` (+ = down)
 * about the poll, the tail swished `swish` px and each hoof where it is (the joints follow by IK).
 */
export interface HorseFrame {
  rise: number;
  pitch: number;
  nod: number;
  headTilt?: number;
  swish: number;
  hooves: Readonly<Record<HorseLegName, Vec2>>;
}

/** The saddle, stirrup and bit in a frame: what the rider is placed by. */
export interface RiderMounts {
  saddle: Vec2;
  stirrup: Vec2;
  mouth: Vec2;
}

/** Builds the horse of `frame` and puts on it the rider `seat` places (pure). */
export const assembleHorsePose = (
  frame: HorseFrame, seat: (mounts: RiderMounts) => { rider: JointPose; lance?: LancePose },
): HorsePose => {
  const { rise, pitch, nod, headTilt = 0, swish, hooves } = frame;
  const pivot = add(BODY.centre, { x: 0, y: -rise });
  const body = (point: Vec2): Vec2 => rotate(add(point, { x: 0, y: -rise }), pivot, pitch);
  const withers = body(BODY.withers);
  const neck = (point: Vec2): Vec2 => rotate(body(point), withers, nod);
  const poll = neck(HEAD.poll);
  const head = (point: Vec2): Vec2 => rotate(neck(point), poll, headTilt);
  const leg = (name: HorseLegName): HorseLeg => {
    const { root: rootAt, bend } = LEG_ROOTS[name];
    const root = body(rootAt);
    const hoof = hooves[name];
    return { root, joint: solveJoint(root, hoof, HORSE_LEG.upper, HORSE_LEG.lower, bend), hoof };
  };
  const croup = body(BODY.croup);
  // The tail hangs from the croup (lying, it rests on the ground).
  const tail = [0, 1, 2].map((strand) => ({
    x: croup.x - 16 - strand * 3 - swish * 0.5,
    y: Math.min(HORSE_GROUND_Y - 1, croup.y + 30 + strand * 5 + swish * 0.3),
  }));
  return {
    nearFore: leg('nearFore'),
    farFore: leg('farFore'),
    nearHind: leg('nearHind'),
    farHind: leg('farHind'),
    barrel: { centre: body(BODY.centre), rx: 40, ry: 17, angle: pitch },
    withers,
    chest: body(BODY.chest),
    croup,
    poll,
    throat: head(HEAD.throat),
    forehead: head(HEAD.forehead),
    muzzle: head(HEAD.muzzle),
    nose: head(HEAD.nose),
    chin: head(HEAD.chin),
    mouth: head(HEAD.mouth),
    tail,
    ...seat({ saddle: body(BODY.saddle), stirrup: body(BODY.stirrup), mouth: head(HEAD.mouth) }),
  };
};

/** The horse and its rider `timeMs` into the `gait` (pure), the rider holding the reins or (`lance`) a lance. */
export const getHorsePose = (timeMs: number, gait: HorseGait, lance?: LanceHold): HorsePose => {
  const spec = GAITS[gait];
  const p = wrap(timeMs / spec.cycleMs);
  const cycle = Math.PI * 2 * p;
  // Walk: a little dip with each of the four beats; gallop: up during the suspension, down on the hind landing;
  // standing: breathing, the head shaken now and then.
  const rise = gait === 'walk' ? spec.bob * Math.cos(cycle * 4) : gait === 'gallop' ? spec.bob * Math.cos(cycle - Math.PI * 1.55) : spec.bob * Math.sin(cycle);
  const pitch = spec.pitch * (gait === 'walk' ? Math.sin(cycle * 2) : Math.sin(cycle + 0.6));
  const nod = spec.nod * (gait === 'walk' ? Math.sin(cycle * 2) : gait === 'gallop' ? Math.sin(cycle - 1.2) : Math.sin(cycle) * Math.max(0, Math.sin(cycle * 3)));
  const { landings } = spec;
  const hoof = (name: HorseLegName): Vec2 => hoofAt(p - landings[name], LEG_ROOTS[name].root.x, spec);
  const frame: HorseFrame = {
    rise, pitch, nod,
    swish: Math.sin(cycle + 0.8) * (gait === 'gallop' ? 7 : gait === 'walk' ? 3 : 2),
    hooves: { nearFore: hoof('nearFore'), farFore: hoof('farFore'), nearHind: hoof('nearHind'), farHind: hoof('farHind') },
  };
  return assembleHorsePose(frame, ({ saddle, stirrup, mouth }) => riderPose(saddle, stirrup, mouth, spec.lean, cycle, gait, lance));
};
