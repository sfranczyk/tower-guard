import { Container, Graphics } from 'pixi.js';
import {
  ARROWS,
  ENEMY_KEEP_HEALTH,
  ENEMY_TOWER_X,
  GAME_HEIGHT,
  GROUND_Y,
  PLAYER_TOWER_X,
  SHOW_HITBOX_DEBUG,
  SNOW_WIND_DRIFT,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import { spatialMix } from '../audio/spatial';
import { Scene, type GameContext } from '../core/Scene';
import { viewWidth } from '../core/viewport';
import { BATTLEGROUNDS, aimColorsOf, type Battleground } from '../data/battlegrounds';
import type { LevelSetup } from '../data/sandbox';
import InputManager from '../managers/InputManager';
import { LocalInput, ManualInput, RecordingInput } from '../input/PlayerInput';
import { leaveCoop, loadoutOf } from '../net/coopLink';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import type { EndInfo } from '../net/protocol';
import Tower from '../objects/Tower';
import { BattleArrows } from './BattleArrows';
import { BattleCamera } from './BattleCamera';
import { BattleEnemies } from './BattleEnemies';
import { BattlePlayers, MIN_SHOT_POWER } from './BattlePlayers';
import { startBattleSync } from './battleSync';
import { DEFAULT_STATUS, slotOfKey, windLabel } from './battleText';
import { showLevelEnd } from './levelEndScreen';
import { PlayerControl, type Player } from './PlayerControl';
import { AimOverlay } from '../rendering/AimOverlay';
import { Background } from '../rendering/Background';
import { CombatSystem, type Foe } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { Snow } from '../rendering/Snow';
import { WeatherSystem } from '../systems/WeatherSystem';
import { livingBowmen } from '../systems/targeting';
import { firstArrow, type Loadout } from '../data/loadout';
import type { Vec2 } from '../types';

/**
 * One level of a sandbox run: the bowman defends the left keep on the level's battleground. Clearing
 * the level moves on to the next one (health carries over); destroying the enemy keep wins the run.
 */
export class GameScene extends Scene {
  private readonly level: LevelSetup;
  private readonly battleground: Battleground;
  private readonly world = new Container();
  /** The level's enemies (also `foes.list`; kept here for the ?debug console: `scene.enemies[0]`). */
  private readonly enemies: Foe[] = [];
  private readonly foes: BattleEnemies;
  /** Every arrow of the level. */
  private readonly shots: BattleArrows;
  private readonly debugGraphics = new Graphics();
  private readonly aimOverlay = new AimOverlay();
  private background!: Background;
  private effects!: EffectsSystem;
  private combat!: CombatSystem;
  /** Storm battlegrounds only: lightning. */
  private weather?: WeatherSystem;
  private snow?: Snow;
  /** This level's wind (px/s² on a normal arrow), rolled from the battleground's strongest wind. */
  private readonly wind: number;
  private playerTower!: Tower;
  private enemyTower!: Tower;
  /** One per player (co-op: two; the host is player 1, the guest player 2). */
  private team!: BattlePlayers;
  private control!: PlayerControl;
  private localInput?: LocalInput;
  /** Co-op online: this browser's role, and the sync with the other browser. */
  private readonly role: 'solo' | 'host' | 'guest';
  private readonly localIndex: number;
  private hostSync?: HostSync;
  private guestSync?: GuestSync;

  private readonly camera = new BattleCamera();
  /** Where the local player's drawn shot would land (x), while aiming. */
  private aimLandingX?: number;
  private optionsVisible = false;
  private gameEnded = false;
  /** What the end screen's button (and Space) does. */
  private endAction?: () => void;

  public constructor(ctx: GameContext) {
    super(ctx);
    const { sandbox, run } = ctx.session;
    this.level = sandbox.levels[run.levelIndex];
    this.battleground = BATTLEGROUNDS[this.level.battleground];
    this.role = ctx.session.net?.role ?? 'solo';
    this.localIndex = this.role === 'guest' ? 1 : 0;
    // Windy maps roll a fresh wind for every level (direction and strength); a co-op guest takes the host's.
    const strongest = this.battleground.wind ?? 0;
    this.wind = this.role === 'guest' ? ctx.session.net!.wind : Math.round((Math.random() * 2 - 1) * strongest);
    this.foes = new BattleEnemies(this.level, {
      world: this.world,
      list: this.enemies,
      guest: this.role === 'guest',
      hostSync: () => this.hostSync,
    });
    this.shots = new BattleArrows({
      world: this.world,
      textures: ctx.textures,
      battleground: this.battleground,
      wind: this.wind,
      arrowTrails: () => ctx.session.arrowTrails,
      effects: () => this.effects,
      playSound: (id, at) => this.playSound(id, at),
      hostSync: () => this.hostSync,
      guestSync: () => this.guestSync,
    });
  }

  private get players(): Player[] {
    return this.team.list;
  }

  /** This browser's player. */
  private get localPlayer(): Player {
    return this.team.local;
  }

  /** This browser's player's quiver. */
  private get localLoadout(): Loadout {
    return loadoutOf(this.ctx.session, this.localIndex);
  }

  public enter(): void {
    const { ui } = this.ctx;
    ui.showScreen('game');
    // Each player fights with their own quiver (co-op: picked by each; alone: the battle setup's).
    ui.setLoadout(this.localLoadout);
    ui.setActiveProjectile(firstArrow(this.localLoadout));

    this.world.sortableChildren = true;
    this.ctx.root.addChild(this.world);
    this.background = new Background(this.world, this.battleground);
    this.effects = new EffectsSystem(this.world);
    this.aimOverlay.setColors(aimColorsOf(this.battleground));

    const { sandbox, run } = this.ctx.session;
    const hillColor = this.battleground.hills[0];
    // Co-op: the keep gets a second, lower tower for the second bowman.
    const twin = this.ctx.session.playerCount > 1;
    this.playerTower = new Tower(PLAYER_TOWER_X, GROUND_Y, { hillColor, enemy: false, twin }, sandbox.keepHealth, run.keepHealth);
    this.enemyTower = new Tower(ENEMY_TOWER_X, GROUND_Y, { hillColor, enemy: true }, ENEMY_KEEP_HEALTH, run.enemyKeepHealth);
    this.debugGraphics.zIndex = 4;
    this.world.addChild(this.playerTower, this.enemyTower, this.aimOverlay, this.debugGraphics);
    this.team = new BattlePlayers({
      ctx: this.ctx,
      world: this.world,
      battleground: this.battleground,
      localIndex: this.localIndex,
      shots: this.shots,
      aimOverlay: this.aimOverlay,
      control: () => this.control,
      effects: () => this.effects,
      hostSync: () => this.hostSync,
      guestSync: () => this.guestSync,
    });
    this.control = new PlayerControl(this.playerTower, {
      enteredTower: (player) => this.team.status(player, 'Hidden in tower · press S to exit'),
      leftTower: (player) => this.team.status(player, DEFAULT_STATUS),
    });

    this.combat = new CombatSystem(
      {
        bowmen: this.team.bowmen,
        playerTower: this.playerTower,
        enemyTower: this.enemyTower,
        enemies: this.enemies,
        arrows: this.shots.list,
        effects: this.effects,
        debug: this.debugGraphics,
        wind: this.wind,
        friendlyFire: () => this.ctx.session.friendlyFire,
        reinforcementsDue: () => this.foes.reinforcementsDue,
      },
      {
        bowmanDamaged: (bowman, amount, hit) => {
          const player = this.team.of(bowman);
          player.health = Math.max(0, player.health - amount);
          bowman.noteHit(hit);
        },
        headshot: () => this.ctx.ui.setStatus(`Headshot! ×${ARROWS.headshotMultiplier} damage`),
        bowmanIgnited: (bowman) => this.team.status(this.team.of(bowman), 'You are on fire! Get out of the flames'),
        enemyShot: (from, angle, speed, shooter) => this.shots.fireEnemy(from, angle, speed, shooter),
        sound: (id, at) => this.playSound(id, at),
      },
    );

    ui.setStatus(DEFAULT_STATUS);
    ui.setTheme(this.battleground.ui);
    this.bindInput();
    ({ hostSync: this.hostSync, guestSync: this.guestSync } = startBattleSync({
      ctx: this.ctx,
      role: this.role,
      wind: this.wind,
      players: this.team,
      enemies: this.enemies,
      shots: this.shots,
      effects: this.effects,
      playerTower: this.playerTower,
      enemyTower: this.enemyTower,
      spawnEnemy: (type, place) => this.foes.spawn(type, place),
      playSound: (id, at) => this.playSound(id, at),
      showGuestEnd: (info) => this.showGuestEnd(info),
    }));
    if (SHOW_HITBOX_DEBUG) {
      // Debug console hook (?debug): window.__towerGuard.scene gives access to the running level.
      (window as unknown as { __towerGuard?: unknown }).__towerGuard = { scene: this };
      this.onExit(() => {
        delete (window as unknown as { __towerGuard?: unknown }).__towerGuard;
      });
    }
    if (this.battleground.weather === 'storm') {
      this.weather = new WeatherSystem(this.world, this.ctx.root, this.background, {
        // After the level is decided lightning still flashes but no longer hurts anyone.
        // A co-op guest's own bolts are only for show (the host's strikes arrive as effects).
        groundStrike: (point) => (this.gameEnded || this.role === 'guest' ? this.effects.lightningStrike(point) : this.combat.lightningStrike(point)),
        thunder: (at, close) => {
          const mix = spatialMix(at.x, this.camera.x, viewWidth());
          this.ctx.sound.play('thunder', { ...mix, gain: mix.gain * (close ? 1 : 0.45) });
        },
      });
    }
    if (this.battleground.weather === 'snow') {
      this.snow = new Snow(this.ctx.root, this.wind * SNOW_WIND_DRIFT);
    }
    const hint = this.battleground.weather === 'storm' ? 'beware of lightning' : this.wind !== 0 ? windLabel(this.wind, this.battleground.wind ?? 0) : 'defend your keep';
    ui.setStatus(`Level ${run.levelIndex + 1} of ${sandbox.levelCount} · ${this.battleground.name} · ${hint}`);
  }

  /** The world keeps running after the level ends; the end screen just overlays it. */
  public update(deltaMs: number): void {
    this.foes.update(deltaMs);
    this.background.update(deltaMs);
    this.weather?.update(deltaMs, this.camera.x);
    this.snow?.update(deltaMs, this.camera.x);
    // A co-op guest moves only its own bowman; the host's comes from the host.
    this.players.filter((player) => this.role !== 'guest' || player.local).forEach((player) => this.team.update(player, deltaMs));
    this.playerTower.update(deltaMs);
    this.enemyTower.update(deltaMs);

    this.debugGraphics.clear();
    this.effects.update(deltaMs);
    this.shots.updateTrails(deltaMs);
    if (this.guestSync) {
      this.guestSync.update(deltaMs);
    } else {
      this.combat.update(deltaMs, this.foes.visible);
    }

    this.shots.prune();
    this.updateAim();
    this.updateHud();
    this.updateCamera(deltaMs);
    if (!this.gameEnded && this.role !== 'guest') {
      this.checkEndConditions();
    }
    this.hostSync?.update(deltaMs);
    // The guest left mid-level: player 2 stands still from now on.
    if (this.hostSync && !this.ctx.session.net) {
      this.hostSync = undefined;
      (this.players[1]?.input as ManualInput | undefined)?.set({ direction: 0, sprint: false, aim: undefined });
    }
  }

  /** Guest: the host decides what comes after the level. */
  private showGuestEnd(info: EndInfo): void {
    this.gameEnded = true;
    this.destroyInput();
    this.ctx.ui.showEndScreen({ ...info, buttonLabel: 'Waiting for the host…', onButton: () => {} });
  }

  public exit(): void {
    super.exit();
    this.destroyInput();
  }

  private bindInput(): void {
    const { ui } = this.ctx;
    this.localInput = new LocalInput(new InputManager({
      eventTarget: this.ctx.app.canvas,
      worldPointFromScreen: (point) => ({ x: point.x + this.camera.x, y: point.y }),
      maxDragDistance: 200,
      screenSize: () => ({ x: viewWidth(), y: GAME_HEIGHT }),
    }));
    // A co-op guest also sends its presses to the host.
    this.team.setLocalInput(this.role === 'guest' ? new RecordingInput(this.localInput) : this.localInput);

    ui.handlers.toggleOptions = () => this.toggleOptions();
    ui.handlers.selectProjectile = (type) => this.localInput?.queueProjectile(type);
    this.onExit(() => {
      ui.handlers.toggleOptions = undefined;
      ui.handlers.selectProjectile = undefined;
    });

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        // Leaving a co-op battle leaves the room (the partner is told).
        leaveCoop(this.ctx);
        this.ctx.goTo('menu');
        return;
      }
      if (event.code === 'KeyI') {
        this.toggleOptions();
      }
      const projectile = this.localLoadout[slotOfKey(event.code)];
      if (projectile) {
        this.localInput?.queueProjectile(projectile);
      }
      if (event.code === 'KeyO') {
        this.foes.toggleVisible();
        this.debugGraphics.clear();
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.gameEnded) {
          this.endAction?.();
        } else {
          this.localInput?.queueBurst();
        }
      }
    });
  }

  /** Stops reading this browser's keyboard and mouse (the level ended); the local player stands still. */
  private destroyInput(): void {
    this.localInput?.destroy();
    this.localInput = undefined;
    if (this.team) {
      this.team.setLocalInput(new ManualInput());
    }
  }

  /** Panned and faded by where it happens relative to the camera (co-op host: the guest hears it too). */
  private playSound(id: SoundId, at: Vec2): void {
    this.ctx.sound.play(id, spatialMix(at.x, this.camera.x, viewWidth()));
    this.hostSync?.sound(id, at);
  }

  private toggleOptions(): void {
    this.optionsVisible = !this.optionsVisible;
    this.ctx.ui.setOptionsVisible(this.optionsVisible);
    this.localInput?.cancelAim();
  }

  /**
   * The local player's aim circles and predicted path (when the preview is on), and where the drawn shot would
   * land (the camera slides towards it).
   */
  private updateAim(): void {
    const { bowman, input, projectile } = this.localPlayer;
    const aim = input.getAim();
    const hasAim = aim !== undefined && !bowman.isStunned && !bowman.isDead;
    const releasePoint = bowman.getBowReleasePoint();
    const path = hasAim && aim.power > MIN_SHOT_POWER ? this.shots.simulate(aim, releasePoint, projectile) : [];
    this.aimLandingX = path.length > 0 ? path[path.length - 1].x : undefined;
    this.aimOverlay.draw(releasePoint, hasAim ? aim : undefined, this.ctx.session.showTrajectory ? path : [], this.ctx.session.showCursorCircle);
  }

  private updateHud(): void {
    this.ctx.ui.updateHud({
      towerHealth: this.playerTower.getHealth(),
      towerMaxHealth: this.playerTower.maxHealth,
      // Player 1's bar first, then player 2's, the same on both screens.
      bowmanHealth: this.players[0].health,
      bowmanMaxHealth: this.ctx.session.sandbox.bowmanHealth,
      partnerHealth: this.team.coop ? this.players[1].health : undefined,
      defeatedEnemies: this.foes.defeated(),
      totalEnemies: this.foes.total,
      level: this.ctx.session.run.levelIndex + 1,
      levelCount: this.ctx.session.sandbox.levelCount,
    });
  }

  /** The camera follows the local bowman and slides towards where he's aiming (BattleCamera). */
  private updateCamera(deltaMs: number): void {
    const { bowman, input } = this.localPlayer;
    const aim = input.getAim();
    const position = this.camera.follow(deltaMs, {
      bowmanX: bowman.x,
      moving: input.getMovementDirection() !== 0 || Math.abs(bowman.velocityX) > 1,
      aimDirectionX: aim?.direction.x,
      aimLandingX: aim ? this.aimLandingX : undefined,
    }, this.effects.cameraShake);
    this.world.position.set(position.x, position.y);
  }

  /** The level is lost once every bowman has fallen, or the keep; won with the enemy keep or every enemy down. */
  private checkEndConditions(): void {
    this.team.handleFallen();
    if (livingBowmen(this.team.bowmen).length === 0 || this.playerTower.isDestroyed()) {
      this.endGame(false);
      return;
    }
    if (this.enemyTower.isDestroyed()) {
      this.endGame(true);
      return;
    }
    if (this.foes.allDefeated()) {
      this.endGame(true, true);
    }
  }

  /** Ends this level (levelEndScreen decides between the next level and the end of the run). */
  private endGame(won: boolean, levelCleared = false): void {
    this.gameEnded = true;
    this.destroyInput();
    this.foes.stopWaves();
    if (!won) {
      this.enemies.forEach((enemy) => enemy.celebrate());
      this.hostSync?.push({ e: 'cheer' });
    }
    const { run } = this.ctx.session;
    this.endAction = showLevelEnd(this.ctx, {
      won,
      levelCleared,
      levelIndex: run.levelIndex,
      defeated: this.foes.defeated(),
      totalEnemies: this.foes.total,
      keep: { health: this.playerTower.getHealth(), max: this.playerTower.maxHealth },
      enemyKeepDestroyed: this.enemyTower.isDestroyed(),
      playerKeepDestroyed: this.playerTower.isDestroyed(),
      playerHealths: this.players.map((player) => player.health),
    }, () => ({
      levelIndex: run.levelIndex + 1,
      bowmanHealths: this.players.map((player) => player.health),
      keepHealth: this.playerTower.getHealth(),
      enemyKeepHealth: this.enemyTower.getHealth(),
    }), this.hostSync);
  }
}
