import { describe, expect, it } from 'vitest';
import { ENEMY_TOWER_X, GROUND_Y, PLAYER_TOWER_X, TERRAIN_AMPLITUDE, WORLD_WIDTH } from '../config';
import { groundAt, useTerrain } from './terrain';

describe('groundAt', () => {
  const samples = Array.from({ length: Math.ceil(WORLD_WIDTH) + 1 }, (_, x) => groundAt(x));

  it('stays within the wave amplitude around GROUND_Y', () => {
    samples.forEach((y) => {
      expect(Math.abs(y - GROUND_Y)).toBeLessThanOrEqual(TERRAIN_AMPLITUDE + 1e-9);
    });
  });

  it('is actually wavy out in the field', () => {
    const field = samples.slice(300, 900);
    expect(Math.max(...field) - Math.min(...field)).toBeGreaterThan(TERRAIN_AMPLITUDE);
  });

  it('is flat at both keeps', () => {
    [PLAYER_TOWER_X, ENEMY_TOWER_X].forEach((keepX) => {
      for (let x = keepX - 100; x <= keepX + 100; x += 5) {
        expect(groundAt(x)).toBeCloseTo(GROUND_Y, 6);
      }
    });
  });

  it('only slopes gently (walkable)', () => {
    for (let x = 1; x < samples.length; x += 1) {
      expect(Math.abs(samples[x] - samples[x - 1])).toBeLessThan(0.2);
    }
  });
});

describe('useTerrain', () => {
  it('scales the waves for a battleground and keeps the keeps flat', () => {
    useTerrain(16);
    const field = Array.from({ length: 600 }, (_, index) => groundAt(300 + index));
    expect(Math.max(...field) - Math.min(...field)).toBeGreaterThan(16);
    expect(Math.max(...field.map((y) => Math.abs(y - GROUND_Y)))).toBeLessThanOrEqual(16 + 1e-9);
    expect(groundAt(PLAYER_TOWER_X)).toBeCloseTo(GROUND_Y, 6);
    useTerrain();
    expect(Math.max(...Array.from({ length: 1200 }, (_, x) => Math.abs(groundAt(x) - GROUND_Y)))).toBeLessThanOrEqual(TERRAIN_AMPLITUDE + 1e-9);
  });
});
