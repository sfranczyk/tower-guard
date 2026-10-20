import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_TOWER_X, KEEP_INSET, SURVIVAL_WORLD_WIDTH, WORLD_WIDTH } from '../config';
import { enemyKeepX, useBattlefield, worldWidth } from './battlefield';

describe('battlefield', () => {
  afterEach(() => useBattlefield());

  it('is the battle field by default', () => {
    expect(worldWidth()).toBe(WORLD_WIDTH);
    expect(enemyKeepX()).toBe(ENEMY_TOWER_X);
  });

  it('shortens to the survival field, the keep spot moving with its end', () => {
    useBattlefield(SURVIVAL_WORLD_WIDTH);
    expect(worldWidth()).toBe(SURVIVAL_WORLD_WIDTH);
    expect(enemyKeepX()).toBe(SURVIVAL_WORLD_WIDTH - KEEP_INSET);
  });
});
