import { describe, expect, it } from 'vitest';
import { JUMP_BUFFER_MS } from '../../config';
import { groundAt } from '../../systems/terrain';
import { BowmanFooting } from './bowmanFooting';

const board = { x: 0, y: 0, width: 1000, height: 540 };

describe('BowmanFooting', () => {
  it('keeps him on the board and stands at its edge', () => {
    const footing = new BowmanFooting(board, 32);
    const pos = { x: -50, y: 0 };
    footing.constrain(pos);
    expect(pos.x).toBe(16);
    expect(footing.isAgainstEdge(pos.x, -1)).toBe(true);
    footing.move(pos, -1, 0.1, false, 120, 1, false);
    expect(footing.horizontalSpeed).toBe(0);
    expect(pos.x).toBe(16);
  });

  it('walks, and stands still in the keep without a direction', () => {
    const footing = new BowmanFooting(board, 32);
    const pos = { x: 500, y: groundAt(500) };
    footing.move(pos, 1, 0.1, false, 120, 1, false);
    expect(pos.x).toBeGreaterThan(500);
    footing.move(pos, 0, 0.1, false, 120, 1, true);
    expect(footing.horizontalSpeed).toBe(0);
  });

  it('jumps, lands on the ground, and a press just before landing jumps again', () => {
    const footing = new BowmanFooting(board, 32);
    const pos = { x: 500, y: groundAt(500) };
    footing.jump(pos);
    expect(footing.verticalVelocity).toBeLessThan(0);
    let falling = false;
    for (let i = 0; i < 300 && !(falling && footing.verticalVelocity < 0); i++) {
      if (footing.verticalVelocity > 0 && !falling && pos.y > groundAt(500) - 10) {
        // Just above the ground on the way down: the press is kept for JUMP_BUFFER_MS.
        falling = true;
        footing.jump(pos);
        expect(footing.jumpBuffer).toBe(JUMP_BUFFER_MS);
      }
      footing.updateVertical(pos, 0.01, false);
      expect(pos.y).toBeLessThanOrEqual(groundAt(500) + 1e-9);
    }
    expect(footing.verticalVelocity).toBeLessThan(0);
  });

  it('is held still in the keep or a vortex', () => {
    const footing = new BowmanFooting(board, 32);
    const pos = { x: 500, y: groundAt(500) - 50 };
    footing.jump(pos);
    footing.updateVertical(pos, 0.1, true);
    expect(footing.verticalVelocity).toBe(0);
    expect(footing.jumpBuffer).toBe(0);
    expect(pos.y).toBe(groundAt(500) - 50);
  });
});
