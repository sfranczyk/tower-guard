import { describe, expect, it } from 'vitest';
import { BATTLEGROUND_IDS, BATTLEGROUNDS } from './battlegrounds';

const channels = (color: number): [number, number, number] => [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
const distance = (a: number, b: number): number => {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};

describe('battleground player colours', () => {
  it('give every map its own bowman look', () => {
    const limbs = new Set(BATTLEGROUND_IDS.map((id) => BATTLEGROUNDS[id].player.limb));
    expect(limbs.size).toBe(BATTLEGROUND_IDS.length);
  });

  it('keep the bowman cloth and plates clearly apart from the map behind him', () => {
    BATTLEGROUND_IDS.forEach((id) => {
      const { player, ground, hills, trees, sky } = BATTLEGROUNDS[id];
      const backdrop = [ground.fill, hills[0], hills[1], trees.colors[1], sky[sky.length - 1]];
      backdrop.forEach((color) => {
        expect(distance(player.limb, color), `${id} cloth vs ${color.toString(16)}`).toBeGreaterThan(90);
      });
      // Plates may sit close to one colour (e.g. grey rock), but not to the ground he stands on.
      expect(distance(player.plate, ground.fill), `${id} plate vs ground`).toBeGreaterThan(60);
    });
  });
});
