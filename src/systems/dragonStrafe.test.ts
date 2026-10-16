import { describe, expect, it } from 'vitest';
import { FIRE_DRAGON_HOVER, FIRE_DRAGON_STRAFE, FIRE_DRAGON_WAIT, PLAYER_TOWER_X, WORLD_WIDTH } from '../config';
import { FIRE_BREATH } from '../rendering/dragonFire';
import { startManoeuvre, stepManoeuvre, type ManoeuvreState } from './dragonManoeuvre';
import { groundReach, strafeAltitude, strafeSide, strafeStartX, stripLength, type StrafeStage } from './dragonStrafe';
import type { HoverSide } from './dragonFlight';
import type { Vec2 } from '../types';

const FRAME = 1000 / 60;
const MOUTH = { ahead: 50, drop: 10 };
const STREAM = 290;
const GROUND = 490;
const REACH = groundReach(MOUTH, STREAM);
const ALTITUDE = strafeAltitude(GROUND, MOUTH, STREAM);

/** Always strafes (rng 0 < weight). */
const step = (state: ManoeuvreState, pos: Vec2, targetX: number, side: HoverSide, rng = (): number => 0): void =>
  stepManoeuvre(state, pos, {
    targetX, side, timeMs: 0, deltaMs: FRAME, followSpeed: 36, ranges: FIRE_DRAGON_HOVER,
    strafe: { reach: REACH, altitude: ALTITUDE }, rng,
  });

/** A dragon at the end of its hover at `x`, at a hover height, about to strafe. */
const hovering = (x: number): { state: ManoeuvreState; pos: Vec2 } => {
  const state = startManoeuvre(280, 200);
  state.phase = 'hover';
  state.hoverLeftMs = 0;
  return { state, pos: { x, y: 280 } };
};

describe('fire dragon strafing run', () => {
  it('flies low enough for the fire to reach the ground', () => {
    const mouthY = ALTITUDE + MOUTH.drop;
    const along = (GROUND - mouthY) / Math.sin(FIRE_DRAGON_STRAFE.aim);
    expect(along).toBeCloseTo(FIRE_DRAGON_STRAFE.reachShare * STREAM);
    expect(along).toBeLessThan(STREAM);
  });

  it('from too close it lurks farther out first, then passes him and brakes behind him', () => {
    const target = 1000;
    const { state, pos } = hovering(target + 200);
    const stages: StrafeStage[] = [];
    for (let time = 0; time < 12000 && state.phase !== 'transit'; time += FRAME) {
      step(state, pos, target, 1, () => (stages.includes('out') ? 0.99 : 0));
      const stage = state.strafe?.stage;
      if (stage && stages[stages.length - 1] !== stage) {
        stages.push(stage);
      }
    }
    expect(stages).toEqual(['lurk', 'run', 'out']);
    expect(pos.x).toBeLessThan(target - FIRE_DRAGON_STRAFE.passBeyond);
    expect(pos.y).toBeCloseTo(ALTITUDE, 0);
  });

  it('near enough its start it sets off at once, diving to the pass height', () => {
    const target = 1000;
    const { state, pos } = hovering(strafeStartX(target, 1, REACH) - 30);
    step(state, pos, target, 1);
    expect(state.strafe?.stage).toBe('run');
    expect(state.strafe?.ignite).toBe(true);
    let lowest = 0;
    for (let time = 0; time < 1500; time += FRAME) {
      step(state, pos, target, 1);
      lowest = Math.max(lowest, pos.y);
    }
    expect(Math.abs(pos.y - ALTITUDE)).toBeLessThan(2);
    expect(lowest).toBeLessThan(ALTITUDE + 5);
  });

  it('puts the bowman in the middle of the burnt strip', () => {
    const target = 1000;
    const { state, pos } = hovering(strafeStartX(target, 1, REACH));
    let runStart: number | undefined;
    const fireAt: number[] = [];
    for (let time = 0; time < 10000; time += FRAME) {
      step(state, pos, target, 1);
      if (state.strafe?.stage === 'run' && runStart === undefined) {
        runStart = time;
      }
      const sinceFlames = runStart === undefined ? -1 : time - runStart - FIRE_BREATH.windUpMs;
      if (sinceFlames >= 0 && sinceFlames <= FIRE_BREATH.flameMs) {
        // Where the fire meets the ground, flying left.
        fireAt.push(pos.x - REACH);
      }
    }
    const [first, last] = [fireAt[0], fireAt[fireAt.length - 1]];
    expect(Math.abs(first - last - stripLength())).toBeLessThan(10);
    expect((first + last) / 2).toBeGreaterThan(target - 25);
    expect((first + last) / 2).toBeLessThan(target + 25);
  });

  it('lurking, it never backs away from a bowman running at it: it sets off instead', () => {
    let target = 1000;
    const { state, pos } = hovering(target + 200);
    step(state, pos, target, 1);
    expect(state.strafe?.stage).toBe('lurk');
    let farthest = pos.x;
    for (let time = 0; time < 4000 && state.strafe?.stage === 'lurk'; time += FRAME) {
      target += 120 * (FRAME / 1000);
      step(state, pos, target, 1);
      farthest = Math.max(farthest, pos.x);
    }
    expect(state.strafe?.stage).toBe('run');
    expect(state.strafe?.side).toBe(1);
    expect(farthest).toBeLessThan(strafeStartX(1000, 1, REACH) + 20);
  });

  it('lurking, when he runs under it to its other side it turns round and attacks him', () => {
    const { state, pos } = hovering(1200);
    step(state, pos, 1000, 1);
    step(state, pos, pos.x + 40, 1);
    expect(state.strafe?.side).toBe(-1);
    expect(state.strafe?.stage).toBe('lurk');
    // Still turning: it waits.
    stepManoeuvre(state, pos, {
      targetX: pos.x + 40, side: -1, timeMs: 0, deltaMs: FRAME, followSpeed: 36, ranges: FIRE_DRAGON_HOVER,
      strafe: { reach: REACH, altitude: ALTITUDE }, turning: true, rng: () => 0,
    });
    expect(state.strafe?.stage).toBe('lurk');
    step(state, pos, pos.x + 40, -1);
    expect(state.strafe?.stage).toBe('run');
  });

  it('goes the other way on the next pass', () => {
    const target = 1000;
    const { state, pos } = hovering(target + 200);
    const sides: HoverSide[] = [];
    for (let time = 0; time < 30000; time += FRAME) {
      step(state, pos, target, state.strafe?.side ?? 1);
      const side = state.strafe?.side;
      if (side && sides[sides.length - 1] !== side) {
        sides.push(side);
      }
    }
    expect(sides.slice(0, 3)).toEqual([1, -1, 1]);
  });

  it('may set up past the world edge by the player keep, never past the far one', () => {
    expect(strafeStartX(150, -1, REACH)).toBeLessThan(0);
    expect(strafeStartX(150, -1, REACH)).toBeGreaterThanOrEqual(-FIRE_DRAGON_STRAFE.edgeOut);
    expect(strafeSide(100, 150, REACH)).toBe(-1);
    expect(strafeSide(WORLD_WIDTH - 50, WORLD_WIDTH - 150, REACH)).toBe(-1);
  });

  it('brakes in time not to fly more than edgeOut past the world edge', () => {
    const { state, pos } = hovering(400);
    step(state, pos, 300, 1);
    let lowest = pos.x;
    for (let time = 0; time < 8000; time += FRAME) {
      step(state, pos, -150, state.strafe?.side ?? 1);
      lowest = Math.min(lowest, pos.x);
    }
    expect(lowest).toBeGreaterThanOrEqual(-FIRE_DRAGON_STRAFE.edgeOut - 2);
  });

  it('everyone in the keep: it gives up its lurk and waits well away from it, without strafing; then comes back', () => {
    const { state, pos } = hovering(PLAYER_TOWER_X + 200);
    step(state, pos, PLAYER_TOWER_X + 100, 1);
    expect(state.strafe?.stage).toBe('lurk');
    const wait = (waiting: boolean, ms: number): void => {
      for (let time = 0; time < ms; time += FRAME) {
        stepManoeuvre(state, pos, {
          targetX: PLAYER_TOWER_X, side: 1, timeMs: time, deltaMs: FRAME, followSpeed: 36,
          ranges: waiting ? FIRE_DRAGON_WAIT : FIRE_DRAGON_HOVER, waiting, rng: () => 0,
          strafe: waiting ? undefined : { reach: REACH, altitude: ALTITUDE },
        });
        if (waiting) {
          expect(state.strafe).toBeUndefined();
        }
      }
    };
    wait(true, 20000);
    expect(pos.x - PLAYER_TOWER_X).toBeGreaterThanOrEqual(FIRE_DRAGON_WAIT.offsetMin - 5);
    expect(pos.y).toBeLessThan(FIRE_DRAGON_WAIT.altitudeMax + 15);
    wait(false, 50);
    expect(state.phase).toBe('transit');
  });

  it('everyone in the keep before the flames are out: it calls the pass off', () => {
    const { state, pos } = hovering(strafeStartX(1000, 1, REACH));
    step(state, pos, 1000, 1);
    expect(state.strafe?.stage).toBe('run');
    stepManoeuvre(state, pos, {
      targetX: PLAYER_TOWER_X, side: 1, timeMs: 0, deltaMs: FRAME, followSpeed: 36, ranges: FIRE_DRAGON_WAIT, waiting: true, rng: () => 0,
    });
    expect(state.phase).toBe('transit');
    expect(state.strafe).toBeUndefined();
  });

  it('without a strafe it never leaves a hover for one', () => {
    const { state, pos } = hovering(1200);
    stepManoeuvre(state, pos, { targetX: 1000, side: 1, timeMs: 0, deltaMs: FRAME, followSpeed: 36, ranges: FIRE_DRAGON_HOVER, rng: () => 0 });
    expect(state.phase).toBe('transit');
  });
});
