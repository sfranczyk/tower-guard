import { GAME_HEIGHT, VIEW_TOP } from '../config';
import type { GameContext } from '../core/Scene';
import { viewWidth } from '../core/viewport';
import { loadSandbox, saveSandbox } from '../core/sandboxStorage';
import { firstArrow, type ArrowType, type Loadout } from '../data/loadout';
import { supportAllowed } from '../data/sandbox';
import { ALLY_TYPES, ENEMY_KINDS } from '../data/enemyKinds';
import InputManager from '../managers/InputManager';
import { LocalInput, ManualInput, RecordingInput, WalkingInput, type PlayerInput } from '../input/PlayerInput';
import { isPresent, leaveCoop, loadoutOf, shareLoadout } from '../net/coopLink';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import { ALLY_ORDER_LABELS } from '../systems/allyOrders';
import { ALLY_KEYS, ORDER_KEY } from '../ui/template';
import type { BattleAllies } from './BattleAllies';
import type { BattlePlayers } from './BattlePlayers';
import { slotOfKey } from './battleText';

export interface BattleControlsDeps {
  ctx: GameContext;
  role: 'solo' | 'host' | 'guest';
  localIndex: number;
  team: BattlePlayers;
  soldiers: BattleAllies;
  /** The camera's left edge (world x), for mapping the mouse to the world. */
  cameraX: () => number;
  /** The battle view is mirrored (settings window, core/keepSide.ts). */
  mirrored: () => boolean;
  hostSync: () => HostSync | undefined;
  guestSync: () => GuestSync | undefined;
  /** The level is decided (the end screen is up). */
  ended: () => boolean;
  /** What the end screen's button (and Space) does. */
  endAction: () => (() => void) | undefined;
  /** The decided level was won (after the end, "View battlefield" walks the bowman; after a loss it moves the camera). */
  won: () => boolean;
  /** The enemy keep's health now (a restarted level keeps its damage). */
  enemyKeepHealth: () => number;
  onKeyDown: (handler: (event: KeyboardEvent) => void) => void;
  /** MOBA: the shop, which I opens by the keep instead of the settings window (Esc closes it). */
  shop?: { readonly open: boolean; toggle(): void; close(): void };
  /** MOBA: Esc opens a menu over the running battle (nothing pauses), and the quiver is always what was bought. */
  moba: boolean;
  onExit: (dispose: () => void) => void;
}

/**
 * What the local player commands in a level besides the bow: the keyboard and mouse (`LocalInput`), the HUD's and pause
 * dialog's handlers, Esc pause (co-op: the host decides, on both screens), the settings window, "Restart level", the
 * quiver in the keep, and summoning and ordering the soldiers.
 */
export class BattleControls {
  /** Esc pauses the battle (MOBA: opens the menu only); the world stands still until Esc again. */
  public paused = false;
  /** Guest: this player's Esc asked the host to pause (so the dialog doesn't say another player did). */
  public pauseAsked = false;
  /** Host: the guest whose Esc paused the battle (their leaving resumes it). */
  private pausedBy?: number;
  private optionsVisible = false;
  private localInput?: LocalInput;
  /** Looking over the field from the end screen: walking the bowman (a win) or moving the camera (a loss). */
  private viewing?: 'walk' | 'pan';

  public constructor(private readonly deps: BattleControlsDeps) {
    this.bind();
  }

  /** The world stands still (paused, and not MOBA, where the battle goes on behind the menu). */
  public get frozen(): boolean {
    return this.paused && !this.deps.moba;
  }

  /** This browser's player's quiver. */
  private get loadout(): Loadout {
    return loadoutOf(this.deps.ctx.session, this.deps.localIndex);
  }

  /** Esc: pauses or resumes (a co-op guest asks the host, which pauses both screens). */
  public togglePause(): void {
    const paused = !this.paused;
    // MOBA: only this browser's menu, the others play on.
    if (this.deps.moba) {
      this.setPaused(paused, false);
      return;
    }
    const guestSync = this.deps.guestSync();
    if (guestSync) {
      this.pauseAsked = paused;
      guestSync.requestPause(paused);
      return;
    }
    this.setPaused(paused, false);
    this.deps.hostSync()?.sendPause(paused);
  }

  public setPaused(paused: boolean, byPartner: boolean): void {
    if (this.deps.ended()) {
      return;
    }
    this.paused = paused;
    this.pauseAsked = false;
    if (!paused) {
      this.setOptionsVisible(false);
    }
    this.localInput?.cancelAim();
    this.deps.ctx.ui.dialogs.showPause(paused ? {
      byPartner,
      coop: this.deps.role !== 'solo',
      canRestart: this.deps.role !== 'guest',
      quiver: this.deps.team.local.bowman.isInTower && !this.deps.moba ? this.loadout : undefined,
      running: this.deps.moba,
    } : undefined);
  }

  /** Host: guest `from` asked to pause or resume; both screens follow. */
  public pauseFor(from: number, paused: boolean): void {
    this.pausedBy = paused ? from : undefined;
    this.setPaused(paused, true);
    this.deps.hostSync()?.sendPause(paused);
  }

  /** Host, each frame: a guest who left mid-level stands still from now on, and a pause they asked for ends. */
  public releaseLeftGuests(): void {
    const hostSync = this.deps.hostSync();
    if (hostSync) {
      this.deps.team.list.forEach((player) => {
        if (player.index > 0 && !isPresent(this.deps.ctx.session, player.index)) {
          (player.input as ManualInput).set({ direction: 0, sprint: false, aim: undefined });
          if (this.pausedBy === player.index && this.paused) {
            this.pausedBy = undefined;
            this.setPaused(false, false);
            hostSync.sendPause(false);
          }
        }
      });
    }
    if (!this.paused) {
      this.pausedBy = undefined;
    }
  }

  /** Stops reading this browser's keyboard and mouse (the level ended); the local player stands still. */
  public destroy(): void {
    this.localInput?.destroy();
    this.localInput = undefined;
    this.viewing = undefined;
    this.deps.team.setLocalInput(new ManualInput());
  }

  /**
   * The end screen's "View battlefield" (`viewing`) or "Back to results": after a win the local bowman walks the field
   * again (no shots, WalkingInput; dead, he can only look), after a loss the keys move the camera (`panInput`).
   */
  public viewBattlefield(viewing: boolean): void {
    this.destroy();
    if (!viewing) {
      return;
    }
    const input = this.createLocalInput();
    this.localInput = input;
    const walks = this.deps.won() && !this.deps.team.local.bowman.isDead;
    this.viewing = walks ? 'walk' : 'pan';
    if (walks) {
      const walking = new WalkingInput(input);
      this.deps.team.setLocalInput(this.deps.role === 'guest' ? new RecordingInput(walking) : walking);
    }
  }

  /** While looking over the field after a loss: the keys that move the camera. */
  public get panInput(): PlayerInput | undefined {
    return this.viewing === 'pan' ? this.localInput : undefined;
  }

  private createLocalInput(): LocalInput {
    return new LocalInput(new InputManager({
      eventTarget: this.deps.ctx.app.canvas,
      worldPointFromScreen: (point) => ({ x: point.x + this.deps.cameraX(), y: point.y + VIEW_TOP }),
      maxDragDistance: 200,
      screenSize: () => ({ x: viewWidth(), y: GAME_HEIGHT }),
      mirrored: () => this.deps.mirrored(),
    }));
  }

  private bind(): void {
    const { ctx, role, team } = this.deps;
    const { ui } = ctx;
    this.localInput = this.createLocalInput();
    // A co-op guest also sends its presses to the host.
    team.setLocalInput(role === 'guest' ? new RecordingInput(this.localInput) : this.localInput);

    ui.handlers.toggleOptions = () => this.toggleOptions();
    ui.handlers.viewBattlefield = (viewing) => this.viewBattlefield(viewing);
    ui.handlers.selectProjectile = (type) => this.localInput?.queueProjectile(type);
    // The player's soldiers: with support on (battle mode only), not yet in online co-op (the guest doesn't see them yet).
    // MOBA: the soldiers are lane minions nobody commands.
    const commandsSoldiers = !ctx.session.net && !ctx.session.moba && supportAllowed(ctx.session.sandbox);
    ui.setAllies(commandsSoldiers ? ALLY_TYPES.map((type) => ({ type, label: ENEMY_KINDS[type].label })) : []);
    if (commandsSoldiers) {
      ui.handlers.summonAlly = (type) => this.summonAlly(type);
      ui.handlers.cycleAllyOrder = () => this.cycleAllyOrder();
    }
    ui.handlers.pauseResume = () => {
      if (this.paused) {
        this.togglePause();
      }
    };
    ui.handlers.pauseRestart = () => {
      if (this.paused && role !== 'guest') {
        this.restartLevel();
      }
    };
    ui.handlers.pauseLoadout = (loadout) => {
      if (this.paused && team.local.bowman.isInTower && !this.deps.moba) {
        this.changeLoadout(loadout);
      }
    };
    ui.handlers.pauseMenu = () => {
      // Leaving a co-op battle leaves the room (the others are told).
      leaveCoop(ctx);
      ctx.goTo('menu');
    };
    this.deps.onExit(() => {
      ui.handlers.toggleOptions = undefined;
      ui.handlers.viewBattlefield = undefined;
      ui.handlers.pauseResume = undefined;
      ui.handlers.pauseMenu = undefined;
      ui.handlers.pauseRestart = undefined;
      ui.handlers.pauseLoadout = undefined;
      ui.handlers.selectProjectile = undefined;
      ui.handlers.summonAlly = undefined;
      ui.handlers.cycleAllyOrder = undefined;
      ui.setAllies([]);
    });

    this.deps.onKeyDown((event) => {
      const ended = this.deps.ended();
      if (event.code === 'Escape') {
        if (this.deps.shop?.open) {
          this.deps.shop.close();
        } else if (this.optionsVisible) {
          this.setOptionsVisible(false);
        } else if (this.viewing) {
          ui.dialogs.setEndViewing(false);
        } else if (!ended) {
          this.togglePause();
        }
        return;
      }
      // I: MOBA's shop (the settings window is the gear button's).
      if (event.code === 'KeyI' && this.deps.shop && !this.paused && !ended) {
        this.deps.shop.toggle();
      }
      if (this.paused) {
        return;
      }
      const projectile = this.loadout[slotOfKey(event.code)];
      if (projectile) {
        this.localInput?.queueProjectile(projectile);
      }
      if (commandsSoldiers && !ended) {
        const ally = ALLY_TYPES.find((type) => event.code === `Key${ALLY_KEYS[type]}`);
        if (ally) {
          this.summonAlly(ally);
        }
        if (event.code === `Key${ORDER_KEY}`) {
          this.cycleAllyOrder();
        }
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (ended) {
          // Not while looking over the field: the results come back first (Esc or the button).
          if (!this.viewing) {
            this.deps.endAction()?.();
          }
        } else {
          this.localInput?.queueBurst();
        }
      }
    });
  }

  /**
   * The pause dialog's "Restart level" (alone or the co-op host): the level starts over with the same enemies and
   * every bowman and the player's keep at full health; the enemy keep keeps its damage. A co-op guest follows the
   * host's new `start`.
   */
  private restartLevel(): void {
    const { session } = this.deps.ctx;
    session.run = {
      ...session.run,
      bowmanHealths: this.deps.team.list.map(() => session.sandbox.bowmanHealth),
      keepHealth: session.sandbox.keepHealth,
      enemyKeepHealth: this.deps.enemyKeepHealth(),
    };
    this.deps.ctx.goTo('game');
  }

  /** The quiver changed in the pause dialog (only while in the keep): kept for the run and for the next setup. */
  private changeLoadout(loadout: Loadout): void {
    const { session, ui } = this.deps.ctx;
    if (this.deps.role === 'guest') {
      // The guest's own quiver lives with this browser's stored setup, not the host's sandbox.
      saveSandbox({ ...loadSandbox(), loadout });
    } else {
      session.sandbox = { ...session.sandbox, loadout };
      saveSandbox(session.sandbox);
    }
    shareLoadout(session, loadout);
    const { projectile } = this.deps.team.local;
    const kept = loadout.includes(projectile as ArrowType);
    ui.setLoadout(loadout);
    ui.setActiveProjectile(kept ? projectile : firstArrow(loadout));
    if (!kept) {
      this.localInput?.queueProjectile(firstArrow(loadout));
    }
  }

  /** A soldier of `type` comes in from beyond the left edge (if his kind's limit and pause allow). */
  private summonAlly(type: (typeof ALLY_TYPES)[number]): void {
    if (this.paused || this.deps.ended()) {
      return;
    }
    const { soldiers } = this.deps;
    if (!soldiers.summon(type)) {
      const slot = soldiers.slots().find((candidate) => candidate.type === type);
      if (slot && slot.alive >= slot.limit) {
        this.deps.ctx.ui.setStatus(`All ${slot.limit} ${ENEMY_KINDS[type].label.toLowerCase()}s are on the field`);
      }
    }
  }

  private cycleAllyOrder(): void {
    if (this.paused || this.deps.ended()) {
      return;
    }
    this.deps.ctx.ui.setStatus(`Soldiers: ${ALLY_ORDER_LABELS[this.deps.soldiers.cycleOrder()]}`);
  }

  /** The settings window opens from the pause dialog only (its button or I while paused); Esc closes it first. */
  private toggleOptions(): void {
    if (this.paused || this.optionsVisible) {
      this.setOptionsVisible(!this.optionsVisible);
    }
  }

  private setOptionsVisible(visible: boolean): void {
    this.optionsVisible = visible;
    this.deps.ctx.ui.setOptionsVisible(visible);
    this.localInput?.cancelAim();
  }
}
