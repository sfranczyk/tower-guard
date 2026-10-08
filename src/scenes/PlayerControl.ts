import { BOWMAN_START_X, BOWMAN_Y, TOWER_ENTRY_ZONE_HEIGHT, TOWER_ENTRY_ZONE_WIDTH, TOWER_EXIT_X_OFFSET } from '../config';
import type { PlayerInput } from '../input/PlayerInput';
import type Bowman from '../objects/Bowman';
import type Tower from '../objects/Tower';
import { groundAt } from '../systems/terrain';
import type { ProjectileType } from '../types';

/** One player in a battle: their bowman, controls, health and weapon. */
export interface Player {
  readonly index: number;
  readonly bowman: Bowman;
  readonly input: PlayerInput;
  /** This browser's player: the camera follows them, and their aim overlay, messages and HUD bar show. */
  readonly local: boolean;
  health: number;
  projectile: ProjectileType;
}

/** Co-op: how far apart the bowmen start. */
const START_SPACING = 45;

export const playerStartX = (index: number): number => BOWMAN_START_X + index * START_SPACING;

/** What PlayerControl reports to the scene (status messages for the local player). */
export interface PlayerControlEvents {
  enteredTower(player: Player): void;
  leftTower(player: Player): void;
}

/**
 * Moves a player's bowman from their controls every frame: walking, sprinting, jumping, hiding in the keep
 * (walk left into its door) and coming out (walk right), and drawing the bow. Shooting is the scene's job.
 */
export class PlayerControl {
  public constructor(
    private readonly tower: Tower,
    private readonly events: PlayerControlEvents,
  ) {}

  public update(player: Player, deltaMs: number): void {
    const { bowman, input } = player;
    const deltaSeconds = deltaMs / 1000;
    if (bowman.isDead) {
      bowman.moveHorizontal(0, deltaSeconds);
      if (!bowman.isInTower) {
        bowman.updateVertical(deltaSeconds);
      }
      bowman.updateAnimation(deltaMs, false);
      return;
    }
    const direction = input.getMovementDirection();
    const sprinting = input.isSprintDown();
    if (input.isJumpPressed()) {
      bowman.jump();
    }

    if (bowman.isInTower) {
      if (direction > 0) {
        this.exitTower(player);
        bowman.moveHorizontal(direction, deltaSeconds, sprinting);
      } else {
        bowman.moveHorizontal(0, deltaSeconds);
      }
    } else {
      bowman.moveHorizontal(direction, deltaSeconds, sprinting);
      bowman.updateVertical(deltaSeconds);
      if (direction < 0 && !bowman.isStunned && !bowman.isPinned && this.canEnterTower(bowman)) {
        this.enterTower(player);
      }
    }

    // The bow follows the draw (knocked down, the draw is lost; Bowman ignores it then).
    const aim = input.getAim();
    if (aim) {
      bowman.setAim(aim.direction, aim.power);
    } else if (bowman.getAim().power > 0) {
      bowman.setAim(bowman.getAim().direction, 0);
    }
    bowman.updateAnimation(deltaMs, direction !== 0, sprinting);
  }

  private canEnterTower(bowman: Bowman): boolean {
    const left = this.tower.x - TOWER_ENTRY_ZONE_WIDTH * 0.65;
    const top = BOWMAN_Y - TOWER_ENTRY_ZONE_HEIGHT * 0.55;
    return bowman.x >= left
      && bowman.x <= left + TOWER_ENTRY_ZONE_WIDTH
      && bowman.y >= top
      && bowman.y <= top + TOWER_ENTRY_ZONE_HEIGHT;
  }

  private enterTower(player: Player): void {
    player.bowman.enterTower();
    // Feet hidden behind the parapet, head and shoulders above the merlons (co-op: the second bowman in the lower tower).
    const spot = this.tower.hideSpot(player.index);
    player.bowman.setTowerPosition(spot.x, spot.y);
    this.events.enteredTower(player);
  }

  private exitTower(player: Player): void {
    const { bowman } = player;
    bowman.exitTower();
    bowman.setHorizontalPosition(this.tower.x + TOWER_EXIT_X_OFFSET);
    bowman.y = groundAt(bowman.x);
    this.events.leftTower(player);
  }
}
