import { describe, expect, it } from 'vitest';
import { getDragonPose } from './dragon';
import { DRAGON_DEATH_MS, DRAGON_HIT_MS, DRAGON_LYING_Y, dragonFallState, lyingDragonPose } from './dragonDeath';
import { DragonGibSimulation } from './dragonGibs';
import { GIB_GROUND_Y } from './stickmanGibs';

describe('dragon death', () => {
  it('flies until the hit, drops, and ends lying flat on the ground', () => {
    expect(dragonFallState(0).lying).toBe(0);
    const end = dragonFallState(DRAGON_DEATH_MS);
    expect(end.y).toBe(DRAGON_LYING_Y);
    expect(end.lying).toBeCloseTo(1);
    expect(Math.abs(end.rotation)).toBeLessThan(0.05);
    // Mid-fall it tips nose-down.
    expect(dragonFallState(DRAGON_HIT_MS + 450).rotation).toBeGreaterThan(0.3);
  });

  it('falls from any height (the game passes its real one) to the same lying pose', () => {
    const high = -700;
    expect(dragonFallState(DRAGON_HIT_MS, high).y).toBe(high);
    const end = dragonFallState(DRAGON_HIT_MS + 3000, high);
    expect(end.y).toBe(DRAGON_LYING_Y);
    expect(end.lying).toBeCloseTo(1);
  });

  it('falls smoothly (no jumps)', () => {
    for (let time = 10; time <= DRAGON_DEATH_MS; time += 10) {
      const a = dragonFallState(time - 10);
      const b = dragonFallState(time);
      expect(Math.abs(b.y - a.y)).toBeLessThan(15);
      expect(Math.abs(b.rotation - a.rotation)).toBeLessThan(0.08);
    }
  });

  it('lays neck, head and tail on the ground when lying', () => {
    const lying = lyingDragonPose(getDragonPose(DRAGON_HIT_MS, 'archer'), 1);
    // Ground is BELLY below the dragon's origin when lying; head and tail rest just above it.
    const groundInPose = GIB_GROUND_Y - DRAGON_LYING_Y;
    expect(lying.head.y).toBeGreaterThan(groundInPose - 16);
    lying.tail.forEach((point) => expect(point.y).toBeGreaterThan(groundInPose - 22));
    expect(lying.bob).toBe(0);
  });

  it('folds the far wing down behind the body when lying', () => {
    const lying = lyingDragonPose(getDragonPose(DRAGON_HIT_MS, 'archer'), 1);
    const { wrist, tip, trail } = lying.farWing;
    // Inside the body ellipse (centre (0, 4), radii 66 × 24), so the body hides it.
    [wrist, tip, ...trail].forEach((point) => expect((point.x / 66) ** 2 + ((point.y - 4) / 24) ** 2).toBeLessThan(1));
  });

  it('blows the dragon apart and every piece comes to rest on the ground', () => {
    const simulation = new DragonGibSimulation(getDragonPose(DRAGON_HIT_MS, 'archer'), -150);
    expect(simulation.pieces.length).toBeGreaterThanOrEqual(18);
    simulation.step(DRAGON_DEATH_MS - DRAGON_HIT_MS);
    simulation.pieces.forEach((piece) => {
      const lowest = Math.max(...DragonGibSimulation.outlineOf(piece).map((point) => point.y));
      expect(lowest).toBeCloseTo(GIB_GROUND_Y, 0);
      // Lying flat: tipped onto its long side.
      const off = Math.atan2(Math.sin(2 * (piece.angle - piece.flatAngle)), Math.cos(2 * (piece.angle - piece.flatAngle)));
      expect(Math.abs(off)).toBeLessThan(0.05);
    });
    expect(simulation.settled).toBe(true);
  });
});
