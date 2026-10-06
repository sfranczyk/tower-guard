import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH, MAX_VIEW_SCALE, MAX_VIEW_WIDTH } from '../config';
import { fitView } from './viewport';

describe('view fit', () => {
  it('keeps the 2.1:1 base view and scales it while the window is narrow', () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(2.1, 2);
    const fit = fitView(900, 800);
    expect(fit.viewWidth).toBe(GAME_WIDTH);
    expect(fit.scale).toBeCloseTo(900 / GAME_WIDTH);
    expect(fit.cssWidth).toBeLessThanOrEqual(900);
  });

  it('widens the view in a window wider than 2.1:1 instead of letterboxing', () => {
    const fit = fitView(1400, 540);
    expect(fit.scale).toBe(1);
    expect(fit.viewWidth).toBe(1400);
    expect(fit.cssHeight).toBe(GAME_HEIGHT);
  });

  it('stops growing at MAX_VIEW_SCALE and widens the view instead, up to MAX_VIEW_WIDTH', () => {
    const big = fitView(2200, 1400);
    expect(big.scale).toBe(MAX_VIEW_SCALE);
    expect(big.viewWidth).toBe(Math.floor(2200 / MAX_VIEW_SCALE));
    const huge = fitView(5000, 1400);
    expect(huge.viewWidth).toBe(MAX_VIEW_WIDTH);
    expect(huge.cssWidth).toBeLessThanOrEqual(5000);
  });
});
