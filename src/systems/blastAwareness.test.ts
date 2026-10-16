import { describe, expect, it } from 'vitest';
import { KAMIKAZE_AWARENESS } from '../config';
import { BlastDodge, blastZones, missChance, type BlastZone } from './blastAwareness';

describe('blastZones', () => {
  it('a fused bomb blasts its reach', () => {
    expect(blastZones([{ owner: 'a', x: 300, radius: 70, fused: true }])).toEqual([{ left: 230, right: 370, owners: new Set(['a']) }]);
  });

  it('chains the bombs a blast reaches, one after another', () => {
    const zones = blastZones([
      { owner: 'a', x: 300, radius: 70, fused: true },
      { owner: 'b', x: 360, radius: 70, fused: false },
      { owner: 'c', x: 420, radius: 70, fused: false },
      { owner: 'd', x: 700, radius: 70, fused: false },
    ]);
    expect(zones).toHaveLength(1);
    expect(zones[0].left).toBe(230);
    expect(zones[0].right).toBe(490);
    expect([...zones[0].owners]).toEqual(['a', 'b', 'c']);
  });

  it('a bomb no blast reaches is no zone', () => {
    expect(blastZones([{ owner: 'd', x: 700, radius: 70, fused: false }])).toEqual([]);
  });
});

describe('missChance', () => {
  const alert = { awareness: 1, healthRatio: 1, buffed: false, busy: false };

  it('a healthy, alert soldier never misses; the undead always do', () => {
    expect(missChance(alert)).toBe(0);
    expect(missChance({ ...alert, awareness: 0 })).toBe(1);
  });

  it('wounds, a spell and a swing each add to the chance', () => {
    expect(missChance({ ...alert, healthRatio: 0 })).toBeCloseTo(KAMIKAZE_AWARENESS.lowHealthMiss);
    expect(missChance({ ...alert, healthRatio: KAMIKAZE_AWARENESS.lowHealthBelow })).toBe(0);
    expect(missChance({ ...alert, buffed: true })).toBeCloseTo(KAMIKAZE_AWARENESS.buffMiss);
    const both = missChance({ ...alert, buffed: true, busy: true });
    expect(both).toBeGreaterThan(KAMIKAZE_AWARENESS.buffMiss);
    expect(both).toBeLessThan(1);
  });
});

describe('BlastDodge', () => {
  const zone: BlastZone<string> = { left: 230, right: 370, owners: new Set(['k']) };
  const near = new Map([['k', 500]]);
  const { margin, hold } = KAMIKAZE_AWARENESS;

  it('flees beyond the zone of a kamikaze it noticed, startled only at first', () => {
    const dodge = new BlastDodge<string>();
    const first = dodge.update(320, true, near, [zone], () => 0, 16, () => 0.5);
    expect(first).toEqual({ kind: 'flee', toX: 370 + margin + hold / 2, startled: true });
    expect(dodge.update(380, true, near, [zone], () => 0, 16, () => 0.5)).toMatchObject({ kind: 'flee', startled: false });
  });

  it('stays out while near it, then hesitates before coming back', () => {
    const dodge = new BlastDodge<string>();
    dodge.update(320, true, near, [zone], () => 0, 16, () => 0.5);
    expect(dodge.update(370 + margin + hold - 1, true, near, [zone], () => 0, 16).kind).toBe('flee');
    expect(dodge.update(400, true, new Map(), [], () => 0, 16, () => 0).kind).toBe('hesitate');
    expect(dodge.update(400, true, new Map(), [], () => 0, KAMIKAZE_AWARENESS.hesitateMinMs).kind).toBe('free');
  });

  it('a missed kamikaze stays missed', () => {
    const dodge = new BlastDodge<string>();
    expect(dodge.update(320, true, near, [zone], () => 1, 16, () => 0.5).kind).toBe('free');
    expect(dodge.update(320, true, near, [zone], () => 0, 16, () => 0.5).kind).toBe('free');
  });

  it('notices nothing beyond its notice range', () => {
    const dodge = new BlastDodge<string>();
    const far = new Map([['k', 320 + KAMIKAZE_AWARENESS.noticeRange + 1]]);
    expect(dodge.update(320, true, far, [zone], () => 0, 16).kind).toBe('free');
  });

  it('flees left when it stands left of what it attacks', () => {
    const dodge = new BlastDodge<string>();
    expect(dodge.update(260, false, near, [zone], () => 0, 16, () => 0.5)).toMatchObject({ toX: 230 - margin - hold / 2 });
  });
});
