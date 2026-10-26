import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH, MAX_VIEW_SCALE, MAX_VIEW_WIDTH, VIEW_CULL_MARGIN } from '../config';
import { clearShownRange, fitView, isShownX, setShownRange } from './viewport';

describe('view fit', () => {
  it('keeps the ~2.14:1 base view and scales it while the window is narrow', () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(2.14, 2);
    const fit = fitView(900, 800);
    expect(fit.viewWidth).toBe(GAME_WIDTH);
    expect(fit.scale).toBeCloseTo(900 / GAME_WIDTH);
    expect(fit.cssWidth).toBeLessThanOrEqual(900);
  });

  it('widens the view in a window wider than the base view instead of letterboxing', () => {
    const fit = fitView(1500, GAME_HEIGHT);
    expect(fit.scale).toBe(1);
    expect(fit.viewWidth).toBe(1500);
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

  it('never widens the view past a narrower battlefield (the canvas is letterboxed instead)', () => {
    const fit = fitView(5000, 1400, 2100);
    expect(fit.scale).toBe(MAX_VIEW_SCALE);
    expect(fit.viewWidth).toBe(2100);
    expect(fit.cssWidth).toBe(Math.floor(2100 * MAX_VIEW_SCALE));
    expect(fitView(1500, GAME_HEIGHT, 2100).viewWidth).toBe(1500);
  });

  it('counts every x as shown until the battle sets its range, then only the range and its margin', () => {
    expect(isShownX(99999)).toBe(true);
    setShownRange(1000, 2000);
    expect(isShownX(1500)).toBe(true);
    expect(isShownX(2000 + VIEW_CULL_MARGIN)).toBe(true);
    expect(isShownX(2001 + VIEW_CULL_MARGIN)).toBe(false);
    expect(isShownX(999 - VIEW_CULL_MARGIN)).toBe(false);
    expect(isShownX(900, 50)).toBe(false);
    clearShownRange();
    expect(isShownX(-99999)).toBe(true);
  });
});
