import { describe, expect, it } from 'vitest';
import { PRIEST_CAST_MS } from '../../config';
import { attackImpactProgress } from '../../rendering/attackSwing';
import { ATTACK_ANIMATION_DURATION_MS, EnemyActions } from './enemyActions';

const actions = (): EnemyActions => new EnemyActions(['overhead', 'thrust'], 'overhead', () => 0.75);

describe('EnemyActions', () => {
  it('lands the swing once, at its strike key', () => {
    const a = actions();
    let hits = 0;
    expect(a.swing(() => hits++)).toBe('thrust');
    const strikeMs = attackImpactProgress('thrust') * ATTACK_ANIMATION_DURATION_MS;
    a.advanceSwing(strikeMs - 10);
    expect(hits).toBe(0);
    a.advanceSwing(20);
    a.advanceSwing(20);
    expect(hits).toBe(1);
    expect(a.advanceSwing(ATTACK_ANIMATION_DURATION_MS)).toBe(1);
    expect(a.swinging).toBe(false);
  });

  it('drops the hit when interrupted', () => {
    const a = actions();
    let hits = 0;
    a.swing(() => hits++, 'overhead');
    a.interrupt();
    a.advanceSwing(ATTACK_ANIMATION_DURATION_MS);
    expect(hits).toBe(0);
  });

  it('waits out the pause between swings', () => {
    const a = actions();
    expect(a.tryStartCooldown(2000)).toBe(true);
    expect(a.tryStartCooldown(2000)).toBe(false);
    a.tickCooldown(2000);
    expect(a.tryStartCooldown(2000)).toBe(true);
  });

  it('casts, staggers and stops', () => {
    const a = actions();
    a.cast();
    expect(a.tryStartCooldown(2000)).toBe(false);
    expect(a.advanceCast(PRIEST_CAST_MS / 2)).toBeCloseTo(0.5);
    a.stagger(100);
    a.stagger(50);
    expect(a.tickStagger(60)).toBe(true);
    a.stop();
    expect(a.casting).toBe(false);
    expect(a.tickStagger(0)).toBe(false);
  });

  it('cheers at its tempo', () => {
    const a = actions();
    a.swing(undefined, 'overhead');
    a.celebrate();
    expect(a.swinging).toBe(false);
    const start = a.cheer!.timeMs;
    expect(a.advanceCheer(100)!.timeMs).toBeCloseTo(start + 100 * a.cheer!.tempo);
  });
});
