import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../types';
import { DRAGON_ARCHER_SHOT_MS, DRAGON_FLAP_MS, dragonHitZones, getDragonPose, type DragonHitZone } from './dragon';

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

describe('dragonHitZones', () => {
  const box = (zone: DragonHitZone) => ({
    left: Math.min(...zone.points.map((p) => p.x)) - zone.padding,
    right: Math.max(...zone.points.map((p) => p.x)) + zone.padding,
    top: Math.min(...zone.points.map((p) => p.y)) - zone.padding,
    bottom: Math.max(...zone.points.map((p) => p.y)) + zone.padding,
  });
  const overlaps = (a: DragonHitZone, b: DragonHitZone): boolean => {
    const [p, q] = [box(a), box(b)];
    return p.left <= q.right && q.left <= p.right && p.top <= q.bottom && q.top <= p.bottom;
  };

  it('chains tail → body → neck → head with no gap, at every point of the wing beat', () => {
    for (let time = 0; time < DRAGON_FLAP_MS; time += 50) {
      const zones = dragonHitZones(getDragonPose(time, 'archer'));
      const body = zones.find((zone) => zone.part === 'body')!;
      const head = zones.find((zone) => zone.part === 'head')!;
      const neck = zones.filter((zone) => zone.part === 'neck');
      const tail = zones.filter((zone) => zone.part === 'tail');
      expect(neck).toHaveLength(2);
      expect(tail).toHaveLength(2);
      expect(zones).toHaveLength(7);
      expect(overlaps(body, neck[0])).toBe(true);
      for (let index = 1; index < neck.length; index += 1) {
        expect(overlaps(neck[index - 1], neck[index])).toBe(true);
      }
      expect(overlaps(neck[neck.length - 1], head)).toBe(true);
      expect(overlaps(tail[tail.length - 1], body)).toBe(true);
      for (let index = 1; index < tail.length; index += 1) {
        expect(overlaps(tail[index - 1], tail[index])).toBe(true);
      }
    }
  });

  it('makes the rider and the dragon head headshots, the rest normal hits', () => {
    const zones = dragonHitZones(getDragonPose(0, 'archer'));
    zones.forEach((zone) => expect(zone.headshot).toBe(zone.part === 'rider' || zone.part === 'head'));
  });
});
