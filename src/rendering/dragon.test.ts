import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { DRAGON_ARCHER_SHOT_MS, DRAGON_FLAP_MS, getDragonPose } from './dragon';

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('getDragonPose', () => {
  it('loops every wing beat', () => {
    const start = getDragonPose(0);
    const next = getDragonPose(DRAGON_FLAP_MS);
    expect(distance(start.nearWing.tip, next.nearWing.tip)).toBeLessThan(1e-6);
    expect(distance(start.head, next.head)).toBeLessThan(1e-6);
    expect(start.bob).toBeCloseTo(next.bob, 9);
  });

  it('beats the wings up and down and bobs the body', () => {
    const tips = Array.from({ length: 36 }, (_, index) => getDragonPose((index / 36) * DRAGON_FLAP_MS));
    const heights = tips.map((pose) => pose.nearWing.tip.y);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(60);
    const bobs = tips.map((pose) => pose.bob);
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeGreaterThan(10);
  });

  it('keeps the rider in the saddle, limbs at full length, and moves smoothly', () => {
    let previous = getDragonPose(0);
    for (let time = 10; time <= DRAGON_FLAP_MS; time += 10) {
      const pose = getDragonPose(time);
      expect(distance(pose.rider.hip, pose.saddle)).toBeLessThan(1e-9);
      expect(distance(pose.rider.shoulder, pose.rider.frontElbow)).toBeCloseTo(21, 6);
      expect(distance(pose.rider.frontElbow, pose.rider.frontHand)).toBeCloseTo(21, 6);
      expect(distance(pose.rider.hip, pose.rider.frontKnee)).toBeCloseTo(30, 6);
      expect(distance(pose.nearWing.tip, previous.nearWing.tip)).toBeLessThan(12);
      expect(distance(pose.head, previous.head)).toBeLessThan(4);
      previous = pose;
    }
  });
});

describe('rider legs', () => {
  it('sits astride: both legs hang down from the saddle along the flank', () => {
    const { rider, saddle } = getDragonPose(300);
    expect(rider.frontFoot.y).toBeGreaterThan(saddle.y + 35);
    expect(rider.rearFoot.y).toBeGreaterThan(saddle.y + 35);
  });
});

describe('archer rider', () => {
  it('stays in the saddle, has a bow and no spear', () => {
    const pose = getDragonPose(500, 'archer');
    expect(distance(pose.rider.hip, pose.saddle)).toBeLessThan(1e-9);
    expect(pose.bow).toBeDefined();
    expect(pose.spear).toBeUndefined();
  });

  it('draws the string, shoots, and holds an arrow only while drawing', () => {
    const samples = Array.from({ length: 80 }, (_, index) => getDragonPose((index / 80) * DRAGON_ARCHER_SHOT_MS, 'archer').bow!);
    const tensions = samples.map((bow) => bow.tension);
    expect(Math.max(...tensions)).toBeGreaterThan(0.95);
    expect(Math.min(...tensions)).toBe(0);
    samples.forEach((bow) => expect(Boolean(bow.arrow)).toBe(bow.tension > 0.05));
    // The arrow points down and ahead of the dragon.
    const drawn = samples.find((bow) => bow.tension > 0.9)!;
    expect(drawn.arrow!.tip.x).toBeGreaterThan(drawn.arrow!.nock.x);
    expect(drawn.arrow!.tip.y).toBeGreaterThan(drawn.arrow!.nock.y);
  });
});
