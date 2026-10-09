import { describe, expect, it } from 'vitest';
import { slotOfKey, windLabel } from './battleText';

describe('slotOfKey', () => {
  it('maps digit keys to quiver slots', () => {
    expect(slotOfKey('Digit1')).toBe(0);
    expect(slotOfKey('Digit9')).toBe(8);
  });

  it('ignores other keys', () => {
    expect(slotOfKey('Digit0')).toBe(-1);
    expect(slotOfKey('KeyA')).toBe(-1);
  });
});

describe('windLabel', () => {
  it('shows direction and strength', () => {
    expect(windLabel(10, 30)).toBe('wind → light');
    expect(windLabel(-20, 30)).toBe('wind ←← moderate');
    expect(windLabel(30, 30)).toBe('wind →→→ strong');
  });

  it('calls a calm map light', () => {
    expect(windLabel(0, 0)).toBe('wind → light');
  });
});
