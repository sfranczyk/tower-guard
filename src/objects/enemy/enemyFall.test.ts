import { describe, expect, it } from 'vitest';
import { FALL_DURATION_MS } from '../../rendering/stickmanFall';
import { KNOCKDOWN_LIE_MS, blastPush, damageReaction, deathKind, fallProgress, pushShare, startFallState, stepFall } from './enemyFall';

describe('deathKind', () => {
  it('picks the fall by what killed it', () => {
    expect(deathKind('headshot')).toBe('deathStiff');
    expect(deathKind('lightning')).toBe('deathStiff');
    expect(deathKind('explosion')).toBe('knockback');
    expect(deathKind('burn')).toBe('deathCrumple');
    expect(deathKind('arrow', 0.2)).toBe('death');
    expect(deathKind('arrow', 0.8)).toBe('deathCrumple');
  });
});

describe('falls', () => {
  it('faces the hit and only pushes a knockback', () => {
    expect(startFallState('death', 120, 100).facing).toBe(1);
    expect(startFallState('death', 80, 100).facing).toBe(-1);
    expect(startFallState('death', 80, 100, undefined, 30).push).toBeUndefined();
    expect(startFallState('knockback', 80, 100, undefined, 30).push).toEqual({ total: 30, applied: 0 });
  });

  it('slides the whole push over the fall, mostly while flying', () => {
    expect(pushShare(0)).toBe(0);
    expect(pushShare(1)).toBeCloseTo(1);
    expect(pushShare(0.72)).toBeCloseTo(0.9);
    let fall = startFallState('knockback', 80, 100, undefined, 40);
    let slid = 0;
    for (let t = 0; t < FALL_DURATION_MS.knockback + 200; t += 16) {
      const step = stepFall(fall, 16);
      slid += step.slide;
      fall = step.fall!;
    }
    expect(slid).toBeCloseTo(40);
    expect(fallProgress(fall)).toBe(1);
  });

  it('gets a knocked-down survivor up after lying a while, and a death stays down', () => {
    let fall = startFallState('knockback', 80, 100, KNOCKDOWN_LIE_MS);
    let stoodUp = false;
    const kinds = new Set<string>();
    for (let t = 0; t < 5000 && !stoodUp; t += 16) {
      const step = stepFall(fall, 16);
      stoodUp = step.stoodUp;
      if (step.fall) {
        fall = step.fall;
        kinds.add(fall.kind);
      }
    }
    expect(stoodUp).toBe(true);
    expect([...kinds]).toEqual(['knockback', 'getUp']);

    let death = startFallState('deathStiff', 80, 100);
    for (let t = 0; t < 5000; t += 16) {
      const step = stepFall(death, 16);
      expect(step.stoodUp).toBe(false);
      death = step.fall!;
    }
    expect(death.kind).toBe('deathStiff');
  });
});

describe('damageReaction', () => {
  it('picks how a hit is taken', () => {
    expect(damageReaction('fall', true, false, 1)).toBe('stayDown');
    expect(damageReaction('shatter', true, true, 1)).toBe('shatter');
    expect(damageReaction('blast', true, true, 0)).toBe('blowApart');
    expect(damageReaction('explosion', true, false, 0.5, 0.99)).toBe('deathFall');
    expect(damageReaction('arrow', true, true, 1)).toBe('dropFromAir');
    expect(damageReaction('lightning', false, false, 1)).toBe('knockdown');
    expect(damageReaction('explosion', false, true, 0)).toBe('none');
    expect(damageReaction('arrow', false, false, 1)).toBe('none');
  });

  it('pushes the closer ones further, a direct hit as the centre', () => {
    expect(blastPush({ cause: 'blast' }).distance).toBe(0);
    expect(blastPush({ cause: 'arrow' }).push).toBe(0);
    expect(blastPush({ cause: 'explosion', blastDistance: 0.2 }).push).toBeGreaterThan(blastPush({ cause: 'explosion', blastDistance: 0.8 }).push);
  });
});
