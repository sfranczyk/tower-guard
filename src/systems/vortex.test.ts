import { describe, expect, it } from 'vitest';
import {
  DRAGON_BUFFET, DRAGON_TURBULENCE_MS, FALL_DAMAGE, THROW_GRAVITY, VORTEX_LEVITATE_BOOST, VORTEX_LEVITATE_FALL, VORTEX_LEVITATE_HEAVY,
  VORTEX_LEVITATE_HEIGHT, VORTEX_LEVITATE_MAX, VORTEX_LEVITATE_SPEED, VORTEX_MASS, VORTEX_MS, VORTEX_RADIUS, VORTEX_TOP,
} from '../config';
import {
  buffetOffset, fallDamage, flingVelocity, funnelCeiling, funnelPosition, levitateHeight, levitateShare, massPace, resistsVortex, throwVelocity,
  turbulenceStrength, vortexPull, vortexRise,
} from './vortex';

/** The masses of data/enemyKinds.ts: a goblin, a fighter (the reference), the black knight, the hammer knight, an ogre. */
const GOBLIN = 0.8;
const FIGHTER = VORTEX_MASS.reference;
const KNIGHT = 1.9;
const HAMMER_KNIGHT = 2.5;
const OGRE = 4.2;

/** Speed hitting the ground after being thrown up at `vy` from `height` px. */
const landingSpeed = (height: number, vy: number): number => Math.sqrt(vy * vy + 2 * THROW_GRAVITY * height);

describe('vortex', () => {
  it('pulls towards the centre without overshooting, nothing out of reach or after it ends; brutes resist it', () => {
    const mid = VORTEX_MS / 2;
    expect(vortexPull(80, mid, 16)).toBeLessThan(0);
    expect(vortexPull(-80, mid, 16)).toBeGreaterThan(0);
    expect(Math.abs(vortexPull(2, mid, 1000))).toBeLessThanOrEqual(2);
    expect(vortexPull(VORTEX_RADIUS + 1, mid, 16)).toBe(0);
    expect(vortexPull(80, VORTEX_MS, 16)).toBe(0);
    expect(resistsVortex(OGRE)).toBe(true);
    expect(resistsVortex(HAMMER_KNIGHT)).toBe(false);
    expect(resistsVortex(FIGHTER)).toBe(false);
  });

  it('lifts up the funnel, circling wider as it goes up', () => {
    expect(vortexRise(1000)).toBeGreaterThan(vortexRise(500));
    const centre = { x: 500, y: 400 };
    const low = funnelPosition(centre, 0, 0);
    const high = funnelPosition(centre, VORTEX_TOP, 0);
    expect(high.y).toBeCloseTo(centre.y - VORTEX_TOP);
    expect(high.x - centre.x).toBeGreaterThan(low.x - centre.x);
  });

  it('throws up and out to the given side; the end of the vortex flings away from the centre', () => {
    const right = throwVelocity(1, 0.5, 0.5);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeLessThan(0);
    expect(throwVelocity(-1, 0.5, 0.5).x).toBeLessThan(0);
    expect(flingVelocity(-30, false, 0.5, 0.5).x).toBeLessThan(0);
    expect(flingVelocity(30, true, 0.5, 0.5).y).toBeLessThan(flingVelocity(30, false, 0.5, 0.5).y);
  });

  it('levitates the one it hit straight up, above the funnel, never past its height; its drop hurts less than a throw', () => {
    expect(levitateHeight(0)).toBe(0);
    expect(levitateHeight(1000)).toBeGreaterThan(VORTEX_LEVITATE_SPEED * 0.7);
    // The funnel is drawn a little above VORTEX_TOP; by the end it hangs well above it.
    expect(levitateHeight(VORTEX_MS)).toBeGreaterThan(VORTEX_TOP * 1.4);
    for (let age = 0; age <= VORTEX_MS; age += 50) {
      expect(levitateHeight(age)).toBeLessThanOrEqual(VORTEX_LEVITATE_HEIGHT + 4);
      expect(levitateHeight(age + 50) - levitateHeight(age)).toBeLessThan((VORTEX_LEVITATE_SPEED * 50) / 1000 + 1);
    }
    // Each further hit lifts it higher (up to the cap); a brute barely leaves the ground.
    expect(levitateHeight(VORTEX_MS, FIGHTER, VORTEX_LEVITATE_BOOST)).toBeGreaterThan(levitateHeight(VORTEX_MS) + VORTEX_LEVITATE_BOOST * 0.9);
    expect(levitateHeight(VORTEX_MS, FIGHTER, 10_000)).toBe(VORTEX_LEVITATE_MAX);
    expect(levitateHeight(VORTEX_MS, OGRE)).toBeLessThan(VORTEX_TOP * 0.4);
    expect(levitateHeight(VORTEX_MS, OGRE)).toBeGreaterThan(10);
    const drop = fallDamage(landingSpeed(levitateHeight(VORTEX_MS), 0)) * VORTEX_LEVITATE_FALL;
    expect(drop).toBeGreaterThan(3);
    expect(drop).toBeLessThan(fallDamage(landingSpeed(VORTEX_TOP, throwVelocity(1, 0.5, 0.5).y)));
  });

  it('takes a fighter (the reference mass) at the base pace, the lighter faster and further, the heavier slower and shorter', () => {
    expect(massPace(FIGHTER)).toBe(1);
    expect(vortexRise(1000, FIGHTER)).toBe(vortexRise(1000));
    expect(throwVelocity(1, 0.5, 0.5, FIGHTER)).toEqual(throwVelocity(1, 0.5, 0.5));
    expect(vortexRise(1000, GOBLIN)).toBeGreaterThan(vortexRise(1000));
    expect(massPace(0.01)).toBe(VORTEX_MASS.lightest);
    expect(vortexRise(1000, KNIGHT)).toBeLessThan(vortexRise(1000));
    expect(Math.abs(vortexPull(80, VORTEX_MS / 2, 16, KNIGHT))).toBeLessThan(Math.abs(vortexPull(80, VORTEX_MS / 2, 16)));
    const thrown = (mass: number): number => throwVelocity(1, 0.5, 0.5, mass).x;
    expect(thrown(GOBLIN)).toBeGreaterThan(thrown(FIGHTER));
    expect(thrown(KNIGHT)).toBeLessThan(thrown(FIGHTER));
    expect(flingVelocity(1, true, 0.5, 0.5, KNIGHT).y).toBeGreaterThan(flingVelocity(1, true, 0.5, 0.5).y);
  });

  it('lifts to the top up to the full-lift mass, then ever lower, not at all from the anchor mass', () => {
    expect(funnelCeiling(KNIGHT)).toBe(VORTEX_TOP);
    expect(funnelCeiling(VORTEX_MASS.fullLift)).toBe(VORTEX_TOP);
    expect(funnelCeiling(HAMMER_KNIGHT)).toBeGreaterThan(VORTEX_TOP * 0.6);
    expect(funnelCeiling(HAMMER_KNIGHT)).toBeLessThan(VORTEX_TOP * 0.85);
    expect(funnelCeiling(VORTEX_MASS.anchor)).toBe(0);
    expect(resistsVortex(VORTEX_MASS.anchor)).toBe(true);
  });

  it('levitates as a man up to the levitate mass, then slower and lower, down to the heavy share', () => {
    expect(levitateShare(VORTEX_MASS.levitateFull)).toBe(1);
    expect(levitateHeight(1500, VORTEX_MASS.levitateFull)).toBe(levitateHeight(1500, FIGHTER));
    expect(levitateShare(OGRE)).toBeCloseTo(VORTEX_LEVITATE_HEAVY);
    expect(levitateShare(10)).toBeCloseTo(VORTEX_LEVITATE_HEAVY);
    // Ever lower, and slower at the start, the heavier.
    [KNIGHT, HAMMER_KNIGHT, OGRE].reduce((lighter, mass) => {
      expect(levitateHeight(VORTEX_MS, mass)).toBeLessThan(levitateHeight(VORTEX_MS, lighter));
      expect(levitateHeight(300, mass)).toBeLessThan(levitateHeight(300, lighter));
      return mass;
    }, FIGHTER);
  });

  it('a throw from the top hurts a lot more than a fling from the ground, and a short drop not at all', () => {
    const fromTop = fallDamage(landingSpeed(VORTEX_TOP, throwVelocity(1, 0.5, 0.5).y));
    const flung = fallDamage(landingSpeed(0, flingVelocity(1, false, 0.5, 0.5).y));
    expect(fromTop).toBeGreaterThan(8);
    expect(fromTop).toBeLessThan(18);
    expect(flung).toBeLessThan(fromTop / 3);
    expect(fallDamage(FALL_DAMAGE.safeSpeed)).toBe(0);
  });

  it('buffets a dragon within bounds, smoothly, fading in and out', () => {
    expect(turbulenceStrength(DRAGON_TURBULENCE_MS)).toBe(0);
    expect(turbulenceStrength(DRAGON_TURBULENCE_MS / 2)).toBe(1);
    expect(turbulenceStrength(0)).toBe(0);
    const still = buffetOffset(1234, 0);
    expect(Math.abs(still.x) + Math.abs(still.y) + Math.abs(still.tilt)).toBe(0);
    for (let time = 0; time < 5000; time += 16) {
      const now = buffetOffset(time, 1);
      const next = buffetOffset(time + 16, 1);
      expect(Math.abs(now.x)).toBeLessThanOrEqual(DRAGON_BUFFET.x);
      expect(Math.abs(now.y)).toBeLessThanOrEqual(DRAGON_BUFFET.y);
      expect(Math.abs(now.tilt)).toBeLessThanOrEqual(DRAGON_BUFFET.tilt);
      expect(Math.abs(next.y - now.y)).toBeLessThan(2.5);
    }
  });
});
