import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import type { BreathControl } from './dragon';

/**
 * Fire breath of the red dragon, as pure functions of time (tested) plus the drawing.
 *
 * A breath: the dragon rears its head back to draw breath (FIRE_BREATH.windUpMs), then thrusts it forward
 * with the jaw wide open and pours out a long stream of fire (FIRE_BREATH.flameMs), and closes its mouth
 * again (FIRE_BREATH.recoverMs) while the last flames burn out. The stream is made of puffs emitted from the
 * mouth every FIRE_PUFF_EVERY_MS; each flies out along the aim, swells, cools from white-yellow through
 * orange and red to smoke, and drifts up a little. Puffs are in the stream's frame (x along the aim,
 * from the mouth), in dragon sprite units.
 */

export const FIRE_BREATH = { windUpMs: 550, flameMs: 2600, recoverMs: 450 } as const;

/** Puff emission interval, flight speed (units/s), lifetime and how far it swells. */
export const FIRE_PUFF_EVERY_MS = 14;
const PUFF_SPEED = 950;
export const FIRE_PUFF_LIFE_MS = 720;
/** A whole breath, until the head is back at rest and the last flames have burnt out. */
export const FIRE_BREATH_MS = FIRE_BREATH.windUpMs + FIRE_BREATH.flameMs + Math.max(FIRE_BREATH.recoverMs, FIRE_PUFF_LIFE_MS);
/** Full reach of the stream (sprite units): a puff's distance when it burns out. */
export const FIRE_REACH = (PUFF_SPEED * FIRE_PUFF_LIFE_MS) / 1000;
const PUFF_RADIUS = { start: 7, end: 70 };
/** Sideways spread (units at full reach) and how far the hot gas rises by the end. */
const SPREAD = 75;
const RISE = 70;
/** Thrust ramps over this long at the start of the flames and at the recovery. */
const THRUST_RAMP_MS = 160;

/** Flame colours from hottest to coolest, and the smoke they end as. */
export const FIRE_COLORS = [0xfff4c2, 0xffd35a, 0xff9a2e, 0xe8512a, 0xa8261c] as const;
const SMOKE = 0x3d3330;

const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/**
 * Head and jaw at `sinceMs` into a breath, aimed `aim` (local radians, + = down): rearing back, thrusting
 * forward through the flames, settling back. Outside 0..FIRE_BREATH_MS the head is at rest.
 */
export const breathControl = (sinceMs: number, aim: number): BreathControl => {
  const { windUpMs, flameMs, recoverMs } = FIRE_BREATH;
  const flameEnd = windUpMs + flameMs;
  if (sinceMs <= 0 || sinceMs >= flameEnd + recoverMs) {
    return { rear: 0, thrust: 0, aim };
  }
  const rear = sinceMs < windUpMs
    ? smooth(sinceMs / windUpMs)
    : 1 - smooth((sinceMs - windUpMs) / THRUST_RAMP_MS);
  const thrust = sinceMs < windUpMs
    ? 0
    : sinceMs < flameEnd
      ? smooth((sinceMs - windUpMs) / THRUST_RAMP_MS)
      : 1 - smooth((sinceMs - flameEnd) / recoverMs);
  return { rear, thrust, aim };
};

/** Whether the mouth pours out fire at `sinceMs` into a breath. */
export const isBreathingFire = (sinceMs: number): boolean =>
  sinceMs >= FIRE_BREATH.windUpMs && sinceMs < FIRE_BREATH.windUpMs + FIRE_BREATH.flameMs;

export interface FirePuff {
  /** Stream frame: x along the aim from the mouth, y sideways (+ = down when aimed level). */
  x: number;
  y: number;
  /** How far the hot gas has risen (sprite units, straight up whatever the aim). */
  lift: number;
  radius: number;
  /** 1 = just out of the mouth (white-hot) … 0 = burnt out. */
  heat: number;
  alpha: number;
}

/** Deterministic 0..1 noise for puff number `index`. */
const noise = (index: number, salt: number): number => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * The puffs alive at `sinceMs` into a breath, oldest (farthest) first. Puffs come out of the mouth while
 * isBreathingFire and keep flying after it closes, so the stream's tail leaves the mouth and burns out.
 */
export const firePuffs = (sinceMs: number): FirePuff[] => {
  const start = FIRE_BREATH.windUpMs;
  const end = start + FIRE_BREATH.flameMs;
  const first = Math.max(0, Math.ceil((sinceMs - FIRE_PUFF_LIFE_MS - start) / FIRE_PUFF_EVERY_MS));
  const last = Math.floor((Math.min(sinceMs, end) - start) / FIRE_PUFF_EVERY_MS);
  const puffs: FirePuff[] = [];
  for (let index = first; index <= last; index += 1) {
    const age = sinceMs - (start + index * FIRE_PUFF_EVERY_MS);
    if (age < 0 || age > FIRE_PUFF_LIFE_MS) {
      continue;
    }
    const t = age / FIRE_PUFF_LIFE_MS;
    // Fast out of the mouth, slowing a little as it spreads.
    const x = FIRE_REACH * (t * (1.25 - 0.25 * t)) * (0.9 + 0.2 * noise(index, 1));
    const side = (noise(index, 2) * 2 - 1) * SPREAD * t + Math.sin(index * 0.7 + sinceMs / 90) * 16 * t;
    puffs.push({
      x,
      y: side,
      lift: RISE * t * t,
      radius: (PUFF_RADIUS.start + (PUFF_RADIUS.end - PUFF_RADIUS.start) * Math.sqrt(t)) * (0.75 + 0.5 * noise(index, 3)),
      heat: 1 - t,
      alpha: t < 0.8 ? 0.95 : 0.95 * (1 - (t - 0.8) / 0.2),
    });
  }
  return puffs;
};

/** Colour of a puff by its heat: the hottest are near white, cooling to dark red, then smoke. */
export const fireColor = (heat: number): number => {
  if (heat < 0.18) {
    return SMOKE;
  }
  const index = Math.min(FIRE_COLORS.length - 1, Math.floor((1 - heat) / 0.82 * FIRE_COLORS.length));
  return FIRE_COLORS[index];
};

/** A puff's centre in sprite space, for a stream leaving `mouth` along `angle` (its gas rises straight up). */
export const puffPosition = (mouth: Vec2, angle: number, { x, y, lift }: FirePuff): Vec2 => ({
  x: mouth.x + x * Math.cos(angle) - y * Math.sin(angle),
  y: mouth.y + x * Math.sin(angle) + y * Math.cos(angle) - lift,
});

/** Puffs still hot enough to set things alight (smoke isn't). */
export const IGNITE_HEAT = 0.22;

/**
 * Draws the stream at `sinceMs` into a breath, from `mouth` along `angle` (sprite space), on top of what's
 * in `g`. Each puff is a soft outer flame with a hotter core, so the stream reads as layered fire.
 */
export const drawFireStream = (g: Graphics, mouth: Vec2, angle: number, sinceMs: number): void => {
  const puffs = firePuffs(sinceMs);
  if (puffs.length === 0) {
    return;
  }
  const toSprite = (puff: FirePuff): Vec2 => puffPosition(mouth, angle, puff);
  puffs.forEach((puff) => {
    const center = toSprite(puff);
    // The outer flame runs a little cooler (orange and red), so the white-hot shows only in the cores.
    g.circle(center.x, center.y, puff.radius).fill({ color: fireColor(puff.heat * 0.8), alpha: puff.alpha * (puff.heat < 0.18 ? 0.55 : 0.85) });
  });
  // Hot cores over the outer flames, near the mouth.
  puffs.filter((puff) => puff.heat > 0.4).forEach((puff) => {
    const center = toSprite(puff);
    g.circle(center.x, center.y, puff.radius * 0.45).fill({ color: fireColor(Math.min(1, puff.heat + 0.25)), alpha: puff.alpha });
  });
};
