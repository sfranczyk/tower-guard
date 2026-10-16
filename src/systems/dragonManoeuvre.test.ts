import { describe, expect, it } from 'vitest';
import { DRAGON_FLIGHT } from '../config';
import { createRandom } from '../utils/math';
import { hoverX } from './dragonFlight';
import { flightShare, kick, pickAltitude, pickHoverMs, startManoeuvre, stepManoeuvre, type ManoeuvreState } from './dragonManoeuvre';
import type { Vec2 } from '../types';

const FRAME = 1000 / 60;
const TARGET = 400;
const TRANSIT_MS = 6000;

const run = (state: ManoeuvreState, pos: Vec2, ms: number, rng = createRandom(1), onFrame?: () => void): void => {
  for (let time = 0; time < ms; time += FRAME) {
    stepManoeuvre(state, pos, { targetX: TARGET, side: 1, timeMs: time, deltaMs: FRAME, followSpeed: 36, rng });
    onFrame?.();
  }
};

/** A dragon already hovering at `altitude`, about to leave for a new point at `next`. */
const leaving = (altitude: number, next: number): { state: ManoeuvreState; pos: Vec2 } => {
  const state = startManoeuvre(next, 260);
  state.phase = 'transit';
  return { state, pos: { x: hoverX(TARGET, 260), y: altitude } };
};

describe('dragon manoeuvres', () => {
  it('hovers for a while, then flies to another height', () => {
    const rng = createRandom(7);
    for (let i = 0; i < 50; i += 1) {
      const ms = pickHoverMs(rng);
      expect(ms).toBeGreaterThanOrEqual(DRAGON_FLIGHT.hoverMinMs);
      expect(ms).toBeLessThanOrEqual(DRAGON_FLIGHT.hoverMaxMs);
      const current = 120 + rng() * 140;
      const next = pickAltitude(current, rng);
      expect(next).toBeGreaterThanOrEqual(DRAGON_FLIGHT.altitudeMin);
      expect(next).toBeLessThanOrEqual(DRAGON_FLIGHT.altitudeMax);
      expect(Math.abs(next - current)).toBeGreaterThanOrEqual(DRAGON_FLIGHT.minAltitudeChange - 1e-9);
    }
  });

  it('flies in, hovers, and sets off again', () => {
    const state = startManoeuvre(180, 260);
    const pos = { x: hoverX(TARGET, 260) + 100, y: 180 };
    const phases = new Set<string>();
    run(state, pos, 3000 + DRAGON_FLIGHT.hoverMaxMs + 500, createRandom(3), () => phases.add(state.phase));
    expect([...phases]).toEqual(['approach', 'hover', 'transit']);
  });

  it('dives faster than it climbs', () => {
    const peak = (from: number, to: number): number => {
      const { state, pos } = leaving(from, to);
      let top = 0;
      run(state, pos, 3000, createRandom(1), () => { top = Math.max(top, Math.hypot(state.vx, state.vy)); });
      return top;
    };
    expect(peak(120, 260)).toBeGreaterThan(peak(260, 120) * 1.2);
  });

  it('arrives at its new point without overshooting, then hovers', () => {
    const { state, pos } = leaving(260, 120);
    let highest = Infinity;
    run(state, pos, TRANSIT_MS, createRandom(1), () => { highest = Math.min(highest, pos.y); });
    expect(state.phase).toBe('hover');
    expect(highest).toBeGreaterThan(120 - 12 - DRAGON_FLIGHT.flareLift - 6);
    expect(flightShare(state)).toBeLessThan(0.3);
  });

  it('a hit only jolts it a little, and it springs back', () => {
    const state = startManoeuvre(180, 260);
    kick(state, true);
    let furthest = 0;
    run(state, { x: hoverX(TARGET, 260), y: 180 }, 2500, createRandom(1), () => { furthest = Math.max(furthest, Math.hypot(state.jolt.x, state.jolt.y)); });
    expect(furthest).toBeGreaterThan(3);
    expect(furthest).toBeLessThan(20);
    expect(Math.hypot(state.jolt.x, state.jolt.y)).toBeLessThan(0.5);
  });
});
