import { ARROW_COOLDOWN_SLACK_MS, BOWMAN_START_X, BOWMAN_Y, PLAYER_TOWER_X, TOWER_ENTRY_ZONE_HEIGHT, TOWER_ENTRY_ZONE_WIDTH } from '../config';
import type { ArrowType } from '../data/loadout';
import type { PlayerInput } from '../input/PlayerInput';
import type Bowman from '../objects/bowman/Bowman';
import type Tower from '../objects/Tower';
import type { Team } from '../data/moba';
import { enemyKeepX, playerKeepX } from '../systems/battlefield';
import type { ArrowCooldowns } from '../systems/arrowCooldowns';
import { groundAt } from '../systems/terrain';
import type { ProjectileType } from '../types';

/** One player in a battle: their bowman, controls, health and weapon. */
export interface Player {
  readonly index: number;
  /** MOBA: blue (the left keep) or red (the right one); everyone is blue in the other modes. */
  readonly team: Team;
  /** Their place in their team (0 first): their tower in the keep, where they start. */
  readonly slot: number;
  readonly bowman: Bowman;
  readonly input: PlayerInput;
  /** This browser's player: the camera follows them, and their aim overlay, messages and HUD bar show. */
  readonly local: boolean;
  health: number;
  projectile: ProjectileType;
  /** Per arrow type, the wait after a shot (the guest's own and, on the host, its copy of it). */
  readonly cooldowns: ArrowCooldowns;
}

/** Co-op: how far apart the bowmen start. */
const START_SPACING = 45;

/**
 * Whether the bow can be drawn: the chosen arrow has a shot ready. While it loads the bowman stands with the bow
 * slack and the aim circles go grey; the drag goes on and the draw starts when the arrow is back. Another player's
 * copy on the host gets the same leeway as their shots.
 */
export const canDrawBow = (player: Player): boolean =>
  player.cooldowns.ready(player.projectile as ArrowType, player.local ? 0 : ARROW_COOLDOWN_SLACK_MS);

/** How far in front of his keep a bowman starts. */
const START_OFFSET = BOWMAN_START_X - PLAYER_TOWER_X;

/** Where player `slot` of `team` starts: in front of their keep (red: the right one, mirrored). */
export const playerStartX = (slot: number, team: Team = 'blue'): number => (team === 'blue'
  ? playerKeepX() + START_OFFSET + slot * START_SPACING
  : enemyKeepX() - START_OFFSET - slot * START_SPACING);

/** What PlayerControl reports to the scene (status messages for the local player). */
export interface PlayerControlEvents {
  enteredTower(player: Player): void;
  leftTower(player: Player): void;
}

/**
 * Moves a player's bowman from their controls every frame: walking, sprinting, jumping, hiding in the keep
 * (jump under it) and coming out (S), and drawing the bow. Shooting is the scene's job.
 */
export class PlayerControl {
  /** `towerOf`: the keep a player hides in (MOBA: their team's). */
  public constructor(
    private readonly towerOf: (player: Player) => Tower,
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
    // A jump under the keep takes him inside instead.
    const jumped = input.isJumpPressed();
    const entering = jumped && !bowman.isInTower && !bowman.isStunned && !bowman.isPinned && this.canEnterTower(player);
    if (entering) {
      this.enterTower(player);
    } else if (jumped) {
      bowman.jump();
    }

    // S leaves the keep (walking doesn't); he steps out under its middle and can walk on at once.
    const exiting = input.isExitPressed() && bowman.isInTower && !entering;
    if (exiting) {
      this.exitTower(player);
    }
    if (bowman.isInTower) {
      bowman.moveHorizontal(0, deltaSeconds);
    } else {
      bowman.moveHorizontal(direction, deltaSeconds, sprinting);
      bowman.updateVertical(deltaSeconds);
    }

    // The bow follows the draw (knocked down, the draw is lost; Bowman ignores it then), once the arrow is loaded.
    const aim = input.getAim();
    if (aim && canDrawBow(player)) {
      bowman.setAim(aim.direction, aim.power);
    } else if (bowman.getAim().power > 0) {
      bowman.setAim(bowman.getAim().direction, 0);
    }
    // Against the edge of the battlefield he stands still, however long the key is held.
    bowman.updateAnimation(deltaMs, direction !== 0 && !bowman.isAgainstEdge(direction), sprinting);
  }

  private canEnterTower(player: Player): boolean {
    const { bowman } = player;
    const left = this.towerOf(player).x - TOWER_ENTRY_ZONE_WIDTH / 2;
    const top = BOWMAN_Y - TOWER_ENTRY_ZONE_HEIGHT * 0.55;
    return bowman.x >= left
      && bowman.x <= left + TOWER_ENTRY_ZONE_WIDTH
      && bowman.y >= top
      && bowman.y <= top + TOWER_ENTRY_ZONE_HEIGHT;
  }

  private enterTower(player: Player): void {
    player.bowman.enterTower();
    // Feet hidden behind the parapet, head and shoulders above the merlons (co-op: the second bowman in the lower tower).
    const spot = this.towerOf(player).hideSpot(player.slot);
    player.bowman.setTowerPosition(spot.x, spot.y);
    this.events.enteredTower(player);
  }

  private exitTower(player: Player): void {
    const { bowman } = player;
    bowman.exitTower();
    // Out at the foot of the tower he hid in, under its middle (co-op: the second bowman under the lower tower).
    bowman.setHorizontalPosition(this.towerOf(player).hideSpot(player.slot).x);
    bowman.y = groundAt(bowman.x);
    this.events.leftTower(player);
  }
}
