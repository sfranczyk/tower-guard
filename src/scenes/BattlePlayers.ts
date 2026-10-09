import type { Container } from 'pixi.js';
import { BOWMAN_Y, GAME_HEIGHT, WORLD_WIDTH } from '../config';
import type { GameContext } from '../core/Scene';
import type { Battleground } from '../data/battlegrounds';
import { firstArrow } from '../data/loadout';
import { ManualInput, type PlayerInput } from '../input/PlayerInput';
import { loadoutOf } from '../net/coopLink';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import Bowman from '../objects/bowman/Bowman';
import { secondPlayerArmor } from '../rendering/armor';
import type { AimOverlay } from '../rendering/AimOverlay';
import type { EffectsSystem } from '../systems/EffectsSystem';
import { groundAt } from '../systems/terrain';
import type { ProjectileType } from '../types';
import type { BattleArrows } from './BattleArrows';
import { PROJECTILE_LABELS } from './battleText';
import { playerStartX, type PlayerControl, type Player } from './PlayerControl';

export const MIN_SHOT_POWER = 0.05;

export interface BattlePlayersDeps {
  ctx: GameContext;
  world: Container;
  battleground: Battleground;
  localIndex: number;
  shots: BattleArrows;
  aimOverlay: AimOverlay;
  control(): PlayerControl;
  effects(): EffectsSystem;
  hostSync(): HostSync | undefined;
  guestSync(): GuestSync | undefined;
}

/**
 * The battle's players (co-op: two; the host is player 1, the guest player 2): their bowmen, each frame's weapon picks,
 * shots and shrapnel bursts, their falls and their status messages.
 */
export class BattlePlayers {
  /** Shared with the co-op sync: entries are replaced in place (new controls), never the array. */
  public readonly list: Player[];

  /**
   * The bowmen: this browser's player first (keyboard and mouse), in co-op a second one in bronze armor whose
   * controls are set from outside (ManualInput). A bowman who fell in an earlier level starts lying where he fell.
   */
  public constructor(private readonly deps: BattlePlayersDeps) {
    const { session } = deps.ctx;
    const { sandbox, run, playerCount } = session;
    const armor = deps.battleground.player;
    this.list = Array.from({ length: Math.max(1, playerCount) }, (_, index) => {
      const bowman = new Bowman(playerStartX(index), BOWMAN_Y, { x: 0, y: 0, width: WORLD_WIDTH, height: GAME_HEIGHT }, {
        armorColors: index === 0 ? armor : secondPlayerArmor(armor),
        // Player 1 is the ranger; in co-op player 2 is the keep warden.
        look: index === 0 ? 'ranger' : 'warden',
      });
      bowman.y = groundAt(bowman.x);
      const health = run.bowmanHealths[index] ?? sandbox.bowmanHealth;
      if (health <= 0) {
        bowman.die({}, true);
      }
      deps.world.addChild(bowman);
      const input: PlayerInput = new ManualInput();
      return { index, bowman, input, local: index === deps.localIndex, health, projectile: firstArrow(loadoutOf(session, index)) as ProjectileType };
    });
  }

  /** This browser's player. */
  public get local(): Player {
    return this.list[this.deps.localIndex];
  }

  public get coop(): boolean {
    return this.list.length > 1;
  }

  public get bowmen(): Bowman[] {
    return this.list.map((player) => player.bowman);
  }

  /** Gives this browser's player new controls. */
  public setLocalInput(input: PlayerInput): void {
    this.list[this.deps.localIndex] = { ...this.local, input };
  }

  public of(bowman: Bowman): Player {
    return this.list.find((player) => player.bowman === bowman) ?? this.local;
  }

  /** Status line message for one player: shown here if they're this browser's, else sent to the guest. */
  public status(player: Player, message: string): void {
    if (player.local) {
      this.deps.ctx.ui.setStatus(message);
    } else {
      this.deps.hostSync()?.push({ e: 'status', player: player.index, text: message });
    }
  }

  /** One player's frame: weapon picks, shots and shrapnel bursts from their controls, then moving the bowman. */
  public update(player: Player, deltaMs: number): void {
    const { ctx, shots } = this.deps;
    const guestSync = this.deps.guestSync();
    const { bowman, input } = player;
    // Only an arrow from that player's own quiver (the guest's picks come over the network).
    const picked = input.takeProjectile();
    const projectile = picked && (loadoutOf(ctx.session, player.index) as readonly ProjectileType[]).includes(picked) ? picked : undefined;
    if (projectile) {
      player.projectile = projectile;
      if (player.local) {
        ctx.ui.setActiveProjectile(projectile);
        ctx.ui.setStatus(PROJECTILE_LABELS[projectile]);
      }
    }
    if (projectile && guestSync) {
      guestSync.queueProjectile(projectile);
    }
    input.takeShots().forEach((aim) => {
      bowman.setAim(aim.direction, aim.power);
      // Knocked down by a blast (or fallen): the draw is lost.
      if (aim.power > MIN_SHOT_POWER && !bowman.isStunned && !bowman.isDead) {
        if (player.local) {
          this.deps.aimOverlay.recordRelease(aim, bowman.getBowReleasePoint());
        }
        // A co-op guest's shots are loosed by the host (the arrow comes back as an event).
        if (guestSync) {
          guestSync.queueShot(aim);
        } else {
          shots.fire(player, aim, aim.power);
        }
      }
      bowman.setAim(aim.direction, 0);
    });
    if (input.takeBurst()) {
      if (guestSync) {
        guestSync.queueBurst();
      } else {
        shots.burstShrapnel(player);
      }
    }
    this.deps.control().update(player, deltaMs);
  }

  /** A bowman at 0 falls (for the rest of the run), the way what killed him decides; the guest plays the same fall. */
  public handleFallen(): void {
    this.list.filter((player) => player.health <= 0 && !player.bowman.isDead).forEach((fallen) => {
      // Frozen, his ice shatters.
      if (fallen.bowman.isFrozen) {
        this.deps.effects().shatter({ x: fallen.bowman.x, y: fallen.bowman.y - 22 });
      }
      const kind = fallen.bowman.die();
      this.deps.hostSync()?.push({ e: 'die', player: fallen.index, kind, fromX: Math.round(fallen.bowman.lastHitFromX ?? fallen.bowman.x) });
      if (this.coop) {
        this.list.forEach((player) => this.status(player, player === fallen ? 'You have fallen · your partner fights on' : 'Your partner has fallen · hold on alone'));
      }
    });
  }
}
