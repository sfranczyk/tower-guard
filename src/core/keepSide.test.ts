import { describe, expect, it } from 'vitest';
import { isMirrored, mirrorX } from './keepSide';

describe('keep side', () => {
  it('mirrors when the own keep is wanted on the other side', () => {
    expect(isMirrored('left', false)).toBe(false);
    expect(isMirrored('right', false)).toBe(true);
    expect(isMirrored('left', true)).toBe(true);
    expect(isMirrored('right', true)).toBe(false);
  });

  it('mirrors a screen x across the view', () => {
    expect(mirrorX(100, 1200)).toBe(1100);
    expect(mirrorX(mirrorX(37, 900), 900)).toBe(37);
  });
});
