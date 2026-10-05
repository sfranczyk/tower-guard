import { describe, expect, it } from 'vitest';
import { GIB_GROUND_Y, GibSimulation } from './stickmanGibs';

describe('GibSimulation', () => {
  it('starts with all ten body parts in the standing pose, above the ground', () => {
    const simulation = new GibSimulation();
    expect(simulation.pieces).toHaveLength(10);
    simulation.pieces.forEach((piece) => expect(GibSimulation.lowestY(piece)).toBeLessThanOrEqual(GIB_GROUND_Y + 1));
  });

  it('throws pieces away from the blast and upwards', () => {
    const blast = { x: 20, y: -20 };
    const simulation = new GibSimulation(blast, 7);
    const head = simulation.pieces.find((piece) => piece.radius > 0)!;
    simulation.step(150);
    expect(head.x).toBeLessThan(blast.x);
    expect(simulation.pieces.some((piece) => piece.vy < 0 || piece.y < -60)).toBe(true);
  });

  it('never lets pieces sink into the ground and settles them within a few seconds', () => {
    const simulation = new GibSimulation({ x: 16, y: -20 }, 3);
    for (let frame = 0; frame < 60 * 4; frame += 1) {
      simulation.step(1000 / 60);
      simulation.pieces.forEach((piece) => expect(GibSimulation.lowestY(piece)).toBeLessThanOrEqual(GIB_GROUND_Y + 0.5));
    }
    expect(simulation.settled).toBe(true);
    expect(simulation.blood).toHaveLength(0);
    expect(simulation.stains.length).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const a = new GibSimulation({ x: 10, y: -10 }, 42);
    const b = new GibSimulation({ x: 10, y: -10 }, 42);
    a.step(800);
    b.step(800);
    expect(a.pieces.map((piece) => [piece.x, piece.y])).toEqual(b.pieces.map((piece) => [piece.x, piece.y]));
  });
});
