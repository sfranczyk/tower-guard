import { describe, expect, it } from 'vitest';
import { damageLabel, damagePopupFrame, shownDamage, showsDamageNumber, stackedPopupBottom } from './damagePopup';

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

describe('shownDamage', () => {
  it('shows the health a blow that kills outright took, any other hit as dealt', () => {
    expect(shownDamage(Number.MAX_SAFE_INTEGER, 25)).toBe(25);
    expect(shownDamage(Number.MAX_SAFE_INTEGER * 0.6, 25)).toBe(25);
    expect(shownDamage(30, 10)).toBe(30);
  });
});

describe('stackedPopupBottom', () => {
  it('stays put with nothing in the way', () => {
    expect(stackedPopupBottom(100, 50, 30, 20, [], 2)).toBe(50);
    // Beside it, or well above it: not in the way.
    expect(stackedPopupBottom(100, 50, 30, 20, [{ x: 160, width: 30, top: 30, bottom: 50 }, { x: 100, width: 30, top: -40, bottom: -20 }], 2)).toBe(50);
  });

  it('goes above the popups it would cover, one after another', () => {
    const first = { x: 100, width: 30, top: 30, bottom: 50 };
    expect(stackedPopupBottom(105, 50, 30, 20, [first], 2)).toBe(28);
    const second = { x: 100, width: 30, top: 8, bottom: 28 };
    expect(stackedPopupBottom(100, 50, 30, 20, [second, first], 2)).toBe(6);
  });
});
