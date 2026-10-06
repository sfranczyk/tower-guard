import { describe, expect, it } from 'vitest';
import { keepDamageStage, keepTones } from './keepStyle';

describe('keepDamageStage', () => {
  it('goes intact → cracked → broken → burning as health drops', () => {
    expect(keepDamageStage(1)).toBe(0);
    expect(keepDamageStage(0.61)).toBe(0);
    expect(keepDamageStage(0.6)).toBe(1);
    expect(keepDamageStage(0.31)).toBe(1);
    expect(keepDamageStage(0.3)).toBe(2);
    expect(keepDamageStage(0.11)).toBe(2);
    expect(keepDamageStage(0.1)).toBe(3);
    expect(keepDamageStage(0)).toBe(3);
  });
});

describe('keepTones', () => {
  const brightness = (color: number): number => ((color >> 16) & 255) + ((color >> 8) & 255) + (color & 255);

  it('orders the tones from light to deep', () => {
    const tones = keepTones(0x587d85);
    expect(brightness(tones.light)).toBeGreaterThan(brightness(tones.cap));
    expect(brightness(tones.cap)).toBeGreaterThan(brightness(tones.base));
    expect(brightness(tones.base)).toBeGreaterThan(brightness(tones.shade));
    expect(brightness(tones.shade)).toBeGreaterThan(brightness(tones.deep));
  });

  it('leans towards the map colours', () => {
    const warm = keepTones(0xd8b479).base;
    const cold = keepTones(0x2e3a44).base;
    expect(brightness(warm)).toBeGreaterThan(brightness(cold));
  });
});
