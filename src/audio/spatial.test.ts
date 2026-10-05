import { describe, expect, it } from 'vitest';
import { SOUND_MAX_PAN, SOUND_MIN_GAIN } from '../config';
import { spatialMix } from './spatial';

describe('spatialMix', () => {
  it('is centred and full volume in the middle of the screen', () => {
    expect(spatialMix(600, 100, 1000)).toEqual({ gain: 1, pan: 0 });
  });

  it('pans towards the edges while staying at full volume on screen', () => {
    expect(spatialMix(100, 100, 1000)).toEqual({ gain: 1, pan: -SOUND_MAX_PAN });
    expect(spatialMix(1100, 100, 1000)).toEqual({ gain: 1, pan: SOUND_MAX_PAN });
  });

  it('fades off screen down to the minimum gain', () => {
    const halfway = spatialMix(1600, 100, 1000);
    expect(halfway.gain).toBeCloseTo(1 - 0.5 * (1 - SOUND_MIN_GAIN));
    expect(halfway.pan).toBe(SOUND_MAX_PAN);
    expect(spatialMix(5000, 100, 1000).gain).toBeCloseTo(SOUND_MIN_GAIN);
    expect(spatialMix(-2000, 100, 1000).gain).toBeCloseTo(SOUND_MIN_GAIN);
  });
});
