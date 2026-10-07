import { describe, expect, it } from 'vitest';
import { getDragonPose } from './dragon';
import { FIRE_BREATH, FIRE_BREATH_MS, FIRE_PUFF_LIFE_MS, FIRE_REACH, breathControl, firePuffs, isBreathingFire } from './dragonFire';

const AIM = 0.6;
const flameStart = FIRE_BREATH.windUpMs;
const flameEnd = FIRE_BREATH.windUpMs + FIRE_BREATH.flameMs;

describe('breathControl', () => {
  it('rests before and after a breath', () => {
    expect(breathControl(0, AIM)).toEqual({ rear: 0, thrust: 0, aim: AIM });
    expect(breathControl(FIRE_BREATH_MS, AIM)).toEqual({ rear: 0, thrust: 0, aim: AIM });
  });

  it('rears back to draw breath, then thrusts forward while the fire pours out', () => {
    expect(breathControl(flameStart - 1, AIM).rear).toBeGreaterThan(0.95);
    expect(breathControl(flameStart - 1, AIM).thrust).toBe(0);
    const pouring = breathControl((flameStart + flameEnd) / 2, AIM);
    expect(pouring.thrust).toBe(1);
    expect(pouring.rear).toBe(0);
  });

  it('moves the head smoothly through the whole breath', () => {
    for (let time = 0; time < FIRE_BREATH_MS; time += 10) {
      const a = breathControl(time, AIM);
      const b = breathControl(time + 10, AIM);
      expect(Math.abs(b.rear - a.rear)).toBeLessThan(0.15);
      expect(Math.abs(b.thrust - a.thrust)).toBeLessThan(0.15);
    }
  });
});

describe('firePuffs', () => {
  it('has no fire before the flames start', () => {
    expect(firePuffs(flameStart - 1)).toHaveLength(0);
    expect(isBreathingFire(flameStart - 1)).toBe(false);
    expect(isBreathingFire(flameStart + 1)).toBe(true);
  });

  it('reaches far once the stream is full, and stays within its reach', () => {
    const puffs = firePuffs(flameStart + FIRE_PUFF_LIFE_MS + 100);
    const farthest = Math.max(...puffs.map((puff) => puff.x));
    expect(farthest).toBeGreaterThan(FIRE_REACH * 0.85);
    expect(farthest).toBeLessThan(FIRE_REACH * 1.15);
  });

  it('keeps burning out after the mouth closes, then is gone', () => {
    const after = firePuffs(flameEnd + FIRE_PUFF_LIFE_MS / 2);
    expect(after.length).toBeGreaterThan(0);
    // The newest puffs have left the mouth.
    expect(Math.min(...after.map((puff) => puff.x))).toBeGreaterThan(FIRE_REACH * 0.3);
    expect(firePuffs(flameEnd + FIRE_PUFF_LIFE_MS + 20)).toHaveLength(0);
  });

  it('cools as it flies: farther puffs are bigger and less hot', () => {
    const puffs = firePuffs(flameStart + 1500);
    const near = puffs[puffs.length - 1];
    const far = puffs[0];
    expect(far.x).toBeGreaterThan(near.x);
    expect(far.heat).toBeLessThan(near.heat);
    expect(far.radius).toBeGreaterThan(near.radius);
  });
});

describe('fire dragon pose', () => {
  it('opens the jaw and turns the head to the aim while breathing fire', () => {
    const resting = getDragonPose(300, 'unarmed');
    const breathing = getDragonPose(300, 'unarmed', undefined, breathControl((flameStart + flameEnd) / 2, 1));
    expect(resting.jaw).toBe(0);
    expect(breathing.jaw).toBe(1);
    // The stream goes exactly along the aim (the head tilts less, the open jaw makes up the rest).
    expect(breathing.mouth.angle).toBeCloseTo(1);
    expect(breathing.headTilt).toBeLessThan(1);
  });

  it('gives the unarmed rider no spear or bow, with both hands forward on the reins', () => {
    const pose = getDragonPose(300, 'unarmed');
    expect(pose.spear).toBeUndefined();
    expect(pose.bow).toBeUndefined();
    expect(pose.rider.frontHand.x).toBeGreaterThan(pose.rider.shoulder.x);
    expect(pose.rider.rearHand.x).toBeGreaterThan(pose.rider.shoulder.x);
  });
});
