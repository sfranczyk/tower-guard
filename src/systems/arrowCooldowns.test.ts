import { describe, expect, it } from 'vitest';
import { ARROW_CHARGES, ARROW_COOLDOWN } from '../config';
import { ArrowCooldowns } from './arrowCooldowns';

describe('ArrowCooldowns', () => {
  it('blocks a one-shot type for its cooldown, other types stay ready', () => {
    const cooldowns = new ArrowCooldowns();
    cooldowns.spend('explosive');
    expect(cooldowns.charges('explosive')).toBe(0);
    expect(cooldowns.ready('explosive')).toBe(false);
    expect(cooldowns.ready('normal')).toBe(true);
    expect(cooldowns.remaining('explosive')).toBe(1);
    cooldowns.tick(ARROW_COOLDOWN.explosive * 500);
    expect(cooldowns.remaining('explosive')).toBeCloseTo(0.5);
    cooldowns.tick(ARROW_COOLDOWN.explosive * 500);
    expect(cooldowns.charges('explosive')).toBe(1);
    expect(cooldowns.remaining('explosive')).toBe(0);
  });

  it('holds several vortex shots that come back one at a time', () => {
    const cooldowns = new ArrowCooldowns();
    const max = ARROW_CHARGES.vortex;
    expect(cooldowns.charges('vortex')).toBe(max);
    for (let shot = 0; shot < max; shot += 1) {
      expect(cooldowns.ready('vortex')).toBe(true);
      cooldowns.spend('vortex');
    }
    expect(cooldowns.ready('vortex')).toBe(false);
    cooldowns.tick(ARROW_COOLDOWN.vortex * 1000);
    expect(cooldowns.charges('vortex')).toBe(1);
    cooldowns.tick(ARROW_COOLDOWN.vortex * 1000 * (max - 1));
    expect(cooldowns.charges('vortex')).toBe(max);
    expect(cooldowns.remaining('vortex')).toBe(0);
  });

  it('accepts a shot within the slack', () => {
    const cooldowns = new ArrowCooldowns();
    cooldowns.spend('fire');
    cooldowns.tick(ARROW_COOLDOWN.fire * 1000 - 200);
    expect(cooldowns.ready('fire')).toBe(false);
    expect(cooldowns.ready('fire', 250)).toBe(true);
  });
});
