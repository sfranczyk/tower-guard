import { describe, expect, it } from 'vitest';
import { BOWMAN_Y, PLAYER_TOWER_X } from '../config';
import { ManualInput } from '../input/PlayerInput';
import type Bowman from '../objects/bowman/Bowman';
import type Tower from '../objects/Tower';
import { PlayerControl, type Player } from './PlayerControl';

/** Just enough of a bowman for PlayerControl: walks at a steady pace, jumps, hides. */
const fakeBowman = (x: number) => {
  const bowman = {
    x,
    y: BOWMAN_Y,
    isDead: false,
    isStunned: false,
    isPinned: false,
    isInTower: false,
    jumps: 0,
    moveHorizontal(direction: number, deltaSeconds = 0) {
      bowman.x += direction * 100 * deltaSeconds;
    },
    updateVertical() {},
    jump() {
      bowman.jumps += 1;
    },
    enterTower() {
      bowman.isInTower = true;
    },
    exitTower() {
      bowman.isInTower = false;
    },
    setTowerPosition(towerX: number, towerY: number) {
      bowman.x = towerX;
      bowman.y = towerY;
    },
    setHorizontalPosition(newX: number) {
      bowman.x = newX;
    },
    getAim: () => ({ direction: { x: 1, y: 0 }, power: 0 }),
    setAim() {},
    isAgainstEdge: () => false,
    updateAnimation() {},
  };
  return bowman;
};

const setup = (x: number) => {
  const bowman = fakeBowman(x);
  const input = new ManualInput();
  const player = { index: 0, bowman: bowman as unknown as Bowman, input, local: true, health: 100, projectile: 'normal' } as Player;
  const tower = { x: PLAYER_TOWER_X, hideSpot: () => ({ x: PLAYER_TOWER_X, y: BOWMAN_Y - 150 }) } as unknown as Tower;
  const control = new PlayerControl(tower, { enteredTower: () => {}, leftTower: () => {} });
  const frame = () => control.update(player, 16);
  return { bowman, input, frame };
};

describe('PlayerControl: the keep', () => {
  it('a jump under the keep takes the bowman inside instead of jumping', () => {
    const { bowman, input, frame } = setup(PLAYER_TOWER_X + 10);
    input.pressJump();
    frame();
    expect(bowman.isInTower).toBe(true);
    expect(bowman.jumps).toBe(0);
  });

  it('a jump away from the keep is a plain jump', () => {
    const { bowman, input, frame } = setup(PLAYER_TOWER_X + 300);
    input.pressJump();
    frame();
    expect(bowman.isInTower).toBe(false);
    expect(bowman.jumps).toBe(1);
  });

  it('walking neither enters nor leaves the keep; S leaves it', () => {
    const { bowman, input, frame } = setup(PLAYER_TOWER_X + 10);
    input.set({ direction: -1 });
    frame();
    expect(bowman.isInTower).toBe(false);

    input.pressJump();
    frame();
    expect(bowman.isInTower).toBe(true);
    input.set({ direction: 1 });
    frame();
    expect(bowman.isInTower).toBe(true);

    input.set({ direction: 0 });
    input.pressExit();
    frame();
    expect(bowman.isInTower).toBe(false);
    expect(bowman.x).toBe(PLAYER_TOWER_X);
    expect(bowman.y).toBeGreaterThan(BOWMAN_Y - 20);
  });

  it('S out in the open does nothing and is not kept for later', () => {
    const { bowman, input, frame } = setup(PLAYER_TOWER_X + 10);
    input.pressExit();
    frame();
    input.pressJump();
    frame();
    frame();
    expect(bowman.isInTower).toBe(true);
  });
});
