import { describe, expect, it } from 'vitest';
import { reliefFormation } from './reliefFormation';

const settings = { knights: 10, squires: 20, medics: 3, gap: 24, frontX: 640, spacing: 28, rankDepth: 6, spawnX: -30 };

describe('relief formation', () => {
  const places = reliefFormation(settings);

  it('brings everyone', () => {
    expect(places.filter((place) => place.type === 'allyKnight')).toHaveLength(10);
    expect(places.filter((place) => place.type === 'squire')).toHaveLength(20);
    expect(places.filter((place) => place.type === 'medic')).toHaveLength(3);
  });

  it('puts the knights in front, lowest on the screen, and the medics at the back on the left', () => {
    const knights = places.filter((place) => place.type === 'allyKnight');
    const medics = places.filter((place) => place.type === 'medic');
    const squires = places.filter((place) => place.type === 'squire');
    expect(Math.min(...knights.map((place) => place.depth))).toBeGreaterThan(Math.max(...squires.map((place) => place.depth)) - 1);
    expect(Math.max(...knights.map((place) => place.x))).toBe(640);
    expect(Math.max(...medics.map((place) => place.x))).toBeLessThan(Math.min(...squires.map((place) => place.x)));
    expect(medics.every((place) => place.depth === 0)).toBe(true);
  });

  it('marches each rank in as a file without anyone passing another', () => {
    [0, 6, 12].forEach((depth) => {
      const file = places.filter((place) => place.depth === depth);
      for (let index = 1; index < file.length; index += 1) {
        expect(file[index].startX).toBeLessThan(file[index - 1].startX);
        expect(file[index].x).toBeLessThan(file[index - 1].x);
      }
      expect(file.every((place) => place.startX <= settings.spawnX)).toBe(true);
    });
  });
});
