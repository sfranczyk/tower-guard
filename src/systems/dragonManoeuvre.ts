import { DRAGON_FLIGHT, FIRE_DRAGON_STRAFE } from '../config';
import type { Vec2 } from '../types';
import { approach, clamp } from '../utils/math';
import { FIRE_BREATH } from '../rendering/dragonFire';
import { cruiseAltitude, flyTowards, hoverX, type HoverSide } from './dragonFlight';
import { passDone, pickStrafe, startStrafe, strafeSide, strafeStartX, type StrafeState } from './dragonStrafe';

/**
 * The dragon archer's manoeuvres (pure; objects/dragon/DragonEnemy.ts runs them): it flies in, hovers and shoots for a
 * while, then flies to a new hover point at another height and distance, so the player has to find it again. In
 * transit it steers with limited acceleration and flies on its energy: diving it speeds up, climbing it slows down;
 * it brakes into the hover from a little above it. A hit jolts it on a spring (`kick`). Tuning: DRAGON_FLIGHT, and
 * each dragon's own hover ranges (DRAGON_ARCHER_HOVER, FIRE_DRAGON_HOVER). The fire dragon (given `strafe`) may leave
 * a hover for a strafing run instead (systems/dragonStrafe.ts, FIRE_DRAGON_STRAFE), and pass after pass until it
 * picks a hover again.
 */

/** Where and how long a dragon hovers (config: DRAGON_ARCHER_HOVER, FIRE_DRAGON_HOVER). */
export interface HoverRanges {
  altitudeMin: number;
  altitudeMax: number;
  minAltitudeChange: number;
  offsetMin: number;
  offsetMax: number;
  hoverMinMs: number;
  hoverMaxMs: number;
}

/** 'approach': flying in from the spawn; 'hover': holding its point; 'transit': flying to a new one; 'strafe': a fire run. */
export type ManoeuvrePhase = 'approach' | 'hover' | 'transit' | 'strafe';

export interface ManoeuvreState {
  phase: ManoeuvrePhase;
  /** Velocity (px/s) of the flight itself, without the jolt. */
  vx: number;
  vy: number;
  hoverLeftMs: number;
  transitMs: number;
  /** The current (or next) hover point: height (y) and distance in front of the target. */
  altitude: number;
  offset: number;
  /** The strafing run under way (phase 'strafe'). */
  strafe?: StrafeState;
  /** The hit jolt: an offset (px) springing back to 0, and its velocity. */
  jolt: { x: number; y: number; vx: number; vy: number };
  /** Animation, eased: wing beat speed (1 = hovering), wings held spread (0..1), nose down (+, radians). */
  flapRate: number;
  glide: number;
  pitch: number;
}

export interface ManoeuvreInput {
  targetX: number;
  side: HoverSide;
  /** The dragon's clock (the hover's slow drift up and down). */
  timeMs: number;
  deltaMs: number;
  /** Its enemy speed: how fast it flies in and follows the bowman while hovering (px/s). */
  followSpeed: number;
  ranges: HoverRanges;
  /** Busy (the fire dragon mid-breath): it stays in its hover until done. */
  hold?: boolean;
  /**
   * Fire dragon: where its fire meets the ground on a pass (px ahead of its centre) and the pass's height (y);
   * without it, it never strafes.
   */
  strafe?: { reach: number; altitude: number };
  /** Swinging round: a strafe doesn't start until it faces its target. */
  turning?: boolean;
  rng: () => number;
}

/** Vertical speed while flying in or hovering (px/s). */
const FOLLOW_CLIMB = 40;
/** Arrived: this close (px) and this slow (px/s). */
const ARRIVE_DISTANCE = 4;
const ARRIVE_SPEED = 20;
/** A transit gives up after this long (its target keeps running away) and hovers where it is. */
const TRANSIT_TIMEOUT_MS = 7000;
/** The jolt's spring (rad/s, critically damped): ~a second back to rest. */
const JOLT_OMEGA = 4;
/** On a pass it holds its height like a spring this stiff (per second). */
const LEVEL_PULL = 3;
/** How fast the animation values follow (per second). */
const EASE = { flap: 2.5, glide: 3, pitch: 1.2 };

export const startManoeuvre = (altitude: number, offset: number): ManoeuvreState => ({
  phase: 'approach', vx: 0, vy: 0, hoverLeftMs: 0, transitMs: 0, altitude, offset,
  jolt: { x: 0, y: 0, vx: 0, vy: 0 }, flapRate: 1, glide: 0, pitch: 0,
});

/** A hover time in hoverMinMs..hoverMaxMs. */
export const pickHoverMs = (ranges: HoverRanges, rng: () => number): number =>
  ranges.hoverMinMs + rng() * Math.max(0, ranges.hoverMaxMs - ranges.hoverMinMs);

/** A new height in altitudeMin..altitudeMax at least minAltitudeChange from `current` (if the range allows it). */
export const pickAltitude = (current: number, ranges: HoverRanges, rng: () => number): number => {
  const { altitudeMin: min, altitudeMax: max, minAltitudeChange: gap } = ranges;
  const below = Math.max(0, current - gap - min);
  const above = Math.max(0, max - (current + gap));
  if (below + above <= 0) {
    return min + rng() * Math.max(0, max - min);
  }
  const pick = rng() * (below + above);
  return pick < below ? min + pick : current + gap + (pick - below);
};

export const pickOffset = (ranges: HoverRanges, rng: () => number): number =>
  ranges.offsetMin + rng() * Math.max(0, ranges.offsetMax - ranges.offsetMin);

/** Its speed as a share of transitSpeed (0..1): how hard the rider finds aiming. */
export const flightShare = (state: ManoeuvreState): number =>
  clamp(Math.hypot(state.vx, state.vy) / Math.max(1, DRAGON_FLIGHT.transitSpeed), 0, 1);

/** Hit from the left (`fromLeft`) or the right: a small jolt away from the arrow and up. */
export const kick = (state: ManoeuvreState, fromLeft: boolean): void => {
  const speed = DRAGON_FLIGHT.hitKick;
  state.jolt.vx += (fromLeft ? 1 : -1) * speed * 0.8;
  state.jolt.vy -= speed * 0.6;
};

/** One frame: moves `pos` (the flight, without the jolt) and updates `state` in place. */
export const stepManoeuvre = (state: ManoeuvreState, pos: Vec2, input: ManoeuvreInput): void => {
  const { deltaMs } = input;
  const dt = deltaMs / 1000;
  if (dt <= 0) {
    return;
  }
  const point = { x: hoverX(input.targetX, state.offset, input.side), y: cruiseAltitude(input.timeMs, state.altitude) };
  let braking = false;
  if (state.phase === 'strafe') {
    braking = stepStrafe(state, pos, input, dt);
  } else if (state.phase === 'transit') {
    braking = steer(state, pos, { x: point.x, y: point.y - DRAGON_FLIGHT.flareLift }, dt);
    state.transitMs += deltaMs;
    const distance = Math.hypot(point.x - pos.x, point.y - DRAGON_FLIGHT.flareLift - pos.y);
    if ((distance <= ARRIVE_DISTANCE && Math.hypot(state.vx, state.vy) <= ARRIVE_SPEED) || state.transitMs >= TRANSIT_TIMEOUT_MS) {
      state.phase = 'hover';
      state.hoverLeftMs = pickHoverMs(input.ranges, input.rng);
    }
  } else {
    const before = { ...pos };
    pos.x = flyTowards(pos.x, point.x, input.followSpeed, deltaMs);
    pos.y = flyTowards(pos.y, point.y, FOLLOW_CLIMB, deltaMs);
    state.vx = (pos.x - before.x) / dt;
    state.vy = (pos.y - before.y) / dt;
    if (state.phase === 'approach' && Math.abs(pos.x - point.x) <= ARRIVE_DISTANCE) {
      state.phase = 'hover';
      state.hoverLeftMs = pickHoverMs(input.ranges, input.rng);
    } else if (state.phase === 'hover') {
      state.hoverLeftMs -= deltaMs;
      if (state.hoverLeftMs <= 0 && !input.hold) {
        moveOn(state, pos, input);
      }
    }
  }
  stepJolt(state.jolt, dt);
  animate(state, braking, dt);
};

/** Done with a hover or a pass: a strafing run (the fire dragon, by chance) or a flight to a new hover point. */
const moveOn = (state: ManoeuvreState, pos: Vec2, input: ManoeuvreInput): void => {
  state.strafe = undefined;
  if (input.strafe && pickStrafe(input.rng)) {
    state.phase = 'strafe';
    state.strafe = startStrafe(strafeSide(pos.x, input.targetX, input.strafe.reach), input.strafe.altitude);
    return;
  }
  state.phase = 'transit';
  state.transitMs = 0;
  state.altitude = pickAltitude(state.altitude, input.ranges, input.rng);
  state.offset = pickOffset(input.ranges, input.rng);
};

/**
 * A strafing run: flies to its start in front of the target, holds there rearing its head (the fire is lit), flies
 * level past him speeding up, then brakes and moves on. True while braking.
 */
const stepStrafe = (state: ManoeuvreState, pos: Vec2, input: ManoeuvreInput, dt: number): boolean => {
  const { strafe } = state;
  if (!strafe || !input.strafe) {
    moveOn(state, pos, { ...input, strafe: undefined });
    return false;
  }
  const { speed, accel } = FIRE_DRAGON_STRAFE;
  const dir = -strafe.side;
  strafe.stageMs += dt * 1000;
  const enter = (stage: StrafeState['stage']): void => {
    strafe.stage = stage;
    strafe.stageMs = 0;
  };
  switch (strafe.stage) {
    case 'setup': {
      strafe.y = input.strafe.altitude;
      const goal = { x: strafeStartX(input.targetX, strafe.side, input.strafe.reach), y: strafe.y };
      const braking = steer(state, pos, goal, dt);
      const arrived = Math.hypot(goal.x - pos.x, goal.y - pos.y) <= ARRIVE_DISTANCE && Math.hypot(state.vx, state.vy) <= ARRIVE_SPEED;
      if (arrived && !input.turning) {
        enter('rear');
        strafe.ignite = true;
      } else if (strafe.stageMs >= TRANSIT_TIMEOUT_MS) {
        // Its target kept running away: it gives up and hovers where it is.
        state.strafe = undefined;
        state.phase = 'hover';
        state.hoverLeftMs = pickHoverMs(input.ranges, input.rng);
      }
      return braking;
    }
    case 'rear':
      state.vx = approach(state.vx, 0, accel * dt);
      state.vy = approach(state.vy, 0, accel * dt);
      break;
    case 'run':
      state.vx = approach(state.vx, dir * speed, accel * dt);
      state.vy = (strafe.y - pos.y) * LEVEL_PULL;
      break;
    case 'out':
      state.vx = approach(state.vx, 0, accel * dt);
      state.vy = (strafe.y - pos.y) * LEVEL_PULL;
      break;
  }
  pos.x += state.vx * dt;
  pos.y += state.vy * dt;
  if (strafe.stage === 'rear' && strafe.stageMs >= FIRE_BREATH.windUpMs) {
    // The flames come out as it sets off.
    enter('run');
  } else if (strafe.stage === 'run' && passDone(strafe, pos.x, input.targetX)) {
    enter('out');
  } else if (strafe.stage === 'out' && Math.abs(state.vx) <= ARRIVE_SPEED) {
    moveOn(state, pos, input);
  }
  return strafe.stage === 'out';
};

/**
 * Transit: steers towards `goal`, arriving (slowing so it can stop in time). Diving raises its top speed and
 * acceleration by up to diveGain, climbing lowers them; braking always has the full accel. True while braking.
 */
const steer = (state: ManoeuvreState, pos: Vec2, goal: Vec2, dt: number): boolean => {
  const { transitSpeed, accel, diveGain } = DRAGON_FLIGHT;
  const dx = goal.x - pos.x;
  const dy = goal.y - pos.y;
  const distance = Math.hypot(dx, dy);
  const down = distance > 0 ? dy / distance : 0;
  const energy = 1 + diveGain * down;
  const top = Math.min(transitSpeed * energy, Math.sqrt(2 * accel * 0.8 * distance));
  const want = distance > 0 ? { x: (dx / distance) * top, y: (dy / distance) * top } : { x: 0, y: 0 };
  let ax = (want.x - state.vx) / dt;
  let ay = (want.y - state.vy) / dt;
  const braking = ax * state.vx + ay * state.vy < 0;
  const limit = braking ? accel : accel * Math.max(0.3, energy);
  const length = Math.hypot(ax, ay);
  if (length > limit) {
    ax = (ax / length) * limit;
    ay = (ay / length) * limit;
  }
  state.vx += ax * dt;
  state.vy += ay * dt;
  pos.x += state.vx * dt;
  pos.y += state.vy * dt;
  return braking && Math.hypot(state.vx, state.vy) > ARRIVE_SPEED;
};

/** The jolt springs back to rest (critically damped). */
const stepJolt = (jolt: ManoeuvreState['jolt'], dt: number): void => {
  const w = JOLT_OMEGA;
  jolt.vx += (-w * w * jolt.x - 2 * w * jolt.vx) * dt;
  jolt.vy += (-w * w * jolt.y - 2 * w * jolt.vy) * dt;
  jolt.x += jolt.vx * dt;
  jolt.y += jolt.vy * dt;
};

/**
 * The wings and body follow the flight: climbing beats faster, diving glides with the wings held spread and the
 * nose down, braking beats hard with the nose up.
 */
const animate = (state: ManoeuvreState, braking: boolean, dt: number): void => {
  const top = Math.max(1, DRAGON_FLIGHT.transitSpeed);
  const climb = clamp(-state.vy / top, 0, 1);
  const dive = clamp(state.vy / top, 0, 1);
  const speed = clamp(Math.hypot(state.vx, state.vy) / top, 0, 1);
  const moving = state.phase === 'transit' || (state.phase === 'strafe' && state.strafe?.stage !== 'rear');
  const flap = braking ? 1.5 : moving ? 1 + climb * 0.9 - dive * 0.5 : 1;
  const glide = moving && !braking ? clamp(dive * 2.5, 0, 1) * clamp(speed * 2, 0, 1) : 0;
  const pitch = braking ? -0.18 : moving ? clamp(Math.atan2(state.vy, Math.abs(state.vx) + 20) * 0.45, -0.25, 0.3) : 0;
  state.flapRate = approach(state.flapRate, flap, EASE.flap * dt);
  state.glide = approach(state.glide, glide, EASE.glide * dt);
  state.pitch = approach(state.pitch, pitch, EASE.pitch * dt);
};
