import { describe, expect, it } from 'vitest';
import { MAX_DELAY_MS, MIN_DELAY_MS, PlaybackClock } from './playbackClock';

const settle = (clock: PlaybackClock): void => {
  for (let i = 0; i < 100; i += 1) {
    clock.advance(100);
  }
};

describe('PlaybackClock', () => {
  it('drops frames older than one already seen and counts the missing ones', () => {
    const clock = new PlaybackClock(50);
    expect(clock.arrive(0, 0, 1000)).toBe(true);
    expect(clock.arrive(3, 150, 1150)).toBe(true);
    expect(clock.arrive(2, 100, 1160)).toBe(false);
    expect(clock.stats.lossRatio).toBeCloseTo(2 / 4);
  });

  it('shows the host time a delay behind, measured from the fastest transit', () => {
    const clock = new PlaybackClock(50);
    expect(clock.showAt(0)).toBeUndefined();
    for (let seq = 0; seq < 40; seq += 1) {
      clock.arrive(seq, seq * 50, 5000 + seq * 50);
    }
    settle(clock);
    expect(clock.stats.delayMs).toBeCloseTo(MIN_DELAY_MS);
    expect(clock.showAt(7000)).toBeCloseTo(2000 - MIN_DELAY_MS);
  });

  it('waits longer on a jittery link, up to a limit', () => {
    const clock = new PlaybackClock(50);
    for (let seq = 0; seq < 200; seq += 1) {
      clock.arrive(seq, seq * 50, seq * 50 + (seq % 4 === 0 ? 80 : 0));
      clock.advance(50);
    }
    expect(clock.stats.jitterMs).toBeGreaterThan(10);
    expect(clock.stats.delayMs).toBeGreaterThan(MIN_DELAY_MS + 20);
    expect(clock.stats.delayMs).toBeLessThanOrEqual(MAX_DELAY_MS);
  });
});
