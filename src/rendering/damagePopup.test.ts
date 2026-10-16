import { describe, expect, it } from 'vitest';
import { damageLabel, damagePopupFrame, showsDamageNumber } from './damagePopup';

describe('damage popup', () => {
  it('labels whole points, at least 1, nothing for no damage', () => {
    expect(damageLabel(12.4)).toBe('12');
    expect(damageLabel(0.2)).toBe('1');
    expect(damageLabel(0)).toBeUndefined();
  });

  it('skips burn and fall ticks', () => {
    expect(showsDamageNumber('headshot')).toBe(true);
    expect(showsDamageNumber('explosion')).toBe(true);
    expect(showsDamageNumber(undefined)).toBe(true);
    expect(showsDamageNumber('burn')).toBe(false);
    expect(showsDamageNumber('fall')).toBe(false);
  });

  it('pops in, rises and fades out', () => {
    const start = damagePopupFrame(0, 1000, 40);
    expect(start.scale).toBeGreaterThan(1);
    expect(start.alpha).toBe(1);
    expect(start.rise).toBe(0);
    const middle = damagePopupFrame(500, 1000, 40);
    expect(middle.scale).toBe(1);
    expect(middle.rise).toBeGreaterThan(20);
    const end = damagePopupFrame(1000, 1000, 40);
    expect(end.alpha).toBe(0);
    expect(end.rise).toBe(40);
  });
});
