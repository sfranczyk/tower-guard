import { describe, expect, it } from 'vitest';
import { ARROW_COOLDOWN } from '../config';
import { ArrowCooldowns } from './arrowCooldowns';

describe('ArrowCooldowns', () => {
  it('blocks a type for its cooldown, other types stay ready', () => {
    const cooldowns = new ArrowCooldowns();
    cooldowns.start('explosive');
    expect(cooldowns.ready('explosive')).toBe(false);
    expect(cooldowns.ready('normal')).toBe(true);
    expect(cooldowns.remaining('explosive')).toBe(1);
    cooldowns.tick(ARROW_COOLDOWN.explosive * 500);
    expect(cooldowns.remaining('explosive')).toBeCloseTo(0.5);
    cooldowns.tick(ARROW_COOLDOWN.explosive * 500);
    expect(cooldowns.ready('explosive')).toBe(true);
    expect(cooldowns.remaining('explosive')).toBe(0);
  });

  it('accepts a shot within the slack', () => {
    const cooldowns = new ArrowCooldowns();
    cooldowns.start('vortex');
    cooldowns.tick(ARROW_COOLDOWN.vortex * 1000 - 200);
    expect(cooldowns.ready('vortex')).toBe(false);
    expect(cooldowns.ready('vortex', 250)).toBe(true);
  });
});
