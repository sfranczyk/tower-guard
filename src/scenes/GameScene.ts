import { Container, Graphics } from 'pixi.js';
import {
  BOWMAN_Y,
  ENEMY_KEEP_HEALTH,
  ENEMY_TOWER_X,
  GAME_HEIGHT,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  PLAYER_TOWER_X,
  SHOW_HITBOX_DEBUG,
  SNOW_WIND_DRIFT,
  WORLD_WIDTH,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import { spatialMix } from '../audio/spatial';
import { Scene, type GameContext } from '../core/Scene';
import { viewWidth } from '../core/viewport';
import { BATTLEGROUNDS, aimColorsOf, type Battleground } from '../data/battlegrounds';
import { getEnemyStats } from '../data/enemies';
import { isFlyingType } from '../data/enemyKinds';
import { levelEnemyTotal, type LevelSetup } from '../data/sandbox';
import InputManager from '../managers/InputManager';
import { LocalInput, ManualInput, RecordingInput, type PlayerInput } from '../input/PlayerInput';
import { leaveCoop, loadoutOf } from '../net/coopLink';
import { GuestSync } from '../net/GuestSync';
import { HostSync } from '../net/HostSync';
import type { EndInfo, NetMessage } from '../net/protocol';
import Bowman from '../objects/Bowman';
import DragonEnemy from '../objects/DragonEnemy';
import Enemy from '../objects/Enemy';
import Tower from '../objects/Tower';
import { secondPlayerArmor } from '../rendering/armor';
import { BattleArrows } from './BattleArrows';
import { BattleCamera } from './BattleCamera';
import { levelEndInfo } from './levelEnd';
import { PlayerControl, playerStartX, type Player } from './PlayerControl';
import { AimOverlay } from '../rendering/AimOverlay';
import { Background } from '../rendering/Background';
import { CombatSystem, type Foe } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { Snow } from '../rendering/Snow';
import { WeatherSystem } from '../systems/WeatherSystem';
import { groundAt } from '../systems/terrain';
import { livingBowmen } from '../systems/targeting';
import { WaveDirector } from '../systems/waveDirector';
import { firstArrow, type Loadout } from '../data/loadout';
import type { EnemyType, ProjectileType, Vec2 } from '../types';

const MIN_SHOT_POWER = 0.05;
const DEFAULT_STATUS = 'Drag from the bowman and release to fire';
/** Enemies come in from beyond the right edge of the battlefield (out of view), past the enemy keep. */
const ENEMY_SPAWN_X = WORLD_WIDTH + 60;

const PROJECTILE_LABELS: Record<ProjectileType, string> = {
  normal: 'Normal arrow · reliable damage',
  explosive: 'Explosive bolt · heavy, short high arc, area damage on impact',
  piercing: 'Piercing arrow · light and fast, flat and long, passes through enemies',
  shrapnel: 'Shrapnel arrow · press Space in flight to burst it into three small arrows',
  pinning: 'Pinning arrow · barely hurts, but pins an enemy to the ground for 10 s (zombies 15 s; not brutes or dragons)',
  fire: 'Fire arrow · sets an enemy alight (the fire spreads to those next to it); in the ground it leaves a fire',
  frost: 'Frost arrow · slows an enemy; a second hit or a headshot freezes it solid, and a frozen one shatters',
  vortex: 'Vortex arrow · where it lands a vortex pulls enemies together, then bursts and throws them down',
  fragment: 'Shrapnel fragment',
};

/** Weapon slot keys: Digit1 picks the first slot of the quiver, and so on. */
const slotOfKey = (code: string): number => (/^Digit[1-9]$/.test(code) ? Number(code.slice(5)) - 1 : -1);

/** Status text for the wind: arrows for its direction, one to three by strength. */
const windLabel = (wind: number, strongest: number): string => {
  const strength = Math.max(1, Math.min(3, Math.ceil((Math.abs(wind) / Math.max(1, strongest)) * 3)));
  const arrows = (wind < 0 ? '←' : '→').repeat(strength);
  return `wind ${arrows} ${['light', 'moderate', 'strong'][strength - 1]}`;
};


/**
 * One level of a sandbox run: the bowman defends the left keep on the level's battleground. Clearing
 * the level moves on to the next one (health carries over); destroying the enemy keep wins the run.
 */
export class GameScene extends Scene {
  private readonly level: LevelSetup;
  private readonly battleground: Battleground;
  private readonly totalEnemies: number;
  private readonly world = new Container();
  private readonly enemies: Foe[] = [];
  /** Every arrow of the level. */
  private readonly shots: BattleArrows;
  private readonly debugGraphics = new Graphics();
  private readonly aimOverlay = new AimOverlay();
  /** Releases the level's enemies in waves (set up in enter). */
  private director?: WaveDirector;
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
  private players: Player[] = [];
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
  private spawnedEnemies = 0;
  private optionsVisible = false;
  /** Debug toggle (O key): hides and freezes all enemies. */
  private enemiesVisible = true;
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
    this.totalEnemies = levelEnemyTotal(this.level.enemies);
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

  /** This browser's player. */
  private get localPlayer(): Player {
    return this.players[this.localIndex];
  }

  /** This browser's player's quiver. */
  private get localLoadout(): Loadout {
    return loadoutOf(this.ctx.session, this.localIndex);
  }

  private get coop(): boolean {
    return this.players.length > 1;
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
    this.createPlayers();
    this.control = new PlayerControl(this.playerTower, {
      enteredTower: (player) => this.localStatus(player, 'Hidden in tower · press S to exit'),
      leftTower: (player) => this.localStatus(player, DEFAULT_STATUS),
    });

    this.combat = new CombatSystem(
      {
        bowmen: this.players.map((player) => player.bowman),
        playerTower: this.playerTower,
        enemyTower: this.enemyTower,
        enemies: this.enemies,
        arrows: this.shots.list,
        effects: this.effects,
        debug: this.debugGraphics,
        wind: this.wind,
        friendlyFire: () => this.ctx.session.friendlyFire,
      },
      {
        bowmanDamaged: (bowman, amount, hit) => {
          const player = this.playerOf(bowman);
          player.health = Math.max(0, player.health - amount);
          bowman.noteHit(hit);
        },
        headshot: () => this.ctx.ui.setStatus(`Headshot! ×${HEADSHOT_DAMAGE_MULTIPLIER} damage`),
        bowmanIgnited: (bowman) => this.localStatus(this.playerOf(bowman), 'You are on fire! Get out of the flames'),
        enemyShot: (from, angle, speed, shooter) => this.shots.fireEnemy(from, angle, speed, shooter),
        sound: (id, at) => this.playSound(id, at),
      },
    );

    ui.setStatus(DEFAULT_STATUS);
    ui.setTheme(this.battleground.ui);
    this.bindInput();
    // A co-op guest runs no level of its own: the host's enemies arrive as events.
    if (this.role !== 'guest') {
      this.director = new WaveDirector(this.level.enemies);
    }
    this.startSync();
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
    if (!this.gameEnded && this.director) {
      const alive = this.enemies.filter((enemy) => enemy.isAlive()).length;
      this.director.update(deltaMs, alive).forEach((type) => this.spawnEnemy(type));
    }
    this.background.update(deltaMs);
    this.weather?.update(deltaMs, this.camera.x);
    this.snow?.update(deltaMs, this.camera.x);
    // A co-op guest moves only its own bowman; the host's comes from the host.
    this.players.filter((player) => this.role !== 'guest' || player.local).forEach((player) => this.updatePlayer(player, deltaMs));
    this.playerTower.update(deltaMs);
    this.enemyTower.update(deltaMs);

    this.debugGraphics.clear();
    this.effects.update(deltaMs);
    this.shots.updateTrails(deltaMs);
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
    });
    if (this.guestSync) {
      this.guestSync.update(deltaMs);
    } else {
      this.combat.update(deltaMs, this.enemiesVisible);
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

  /**
   * Co-op online. The host tells the guest the level's setup and then streams it (HostSync), with the guest's
   * controls driving player 2. The guest builds the same battlefield and replays the host's (GuestSync).
   */
  private startSync(): void {
    const net = this.ctx.session.net;
    if (!net || this.role === 'solo') {
      return;
    }
    if (this.role === 'host') {
      this.hostSync = new HostSync(net.transport, {
        players: this.players,
        enemies: this.enemies,
        playerTower: this.playerTower,
        enemyTower: this.enemyTower,
      }, this.players[1].input as ManualInput);
      this.hostSync.watch(this.effects);
      const { sandbox, run } = this.ctx.session;
      net.transport.send({ t: 'start', sandbox, run, wind: this.wind });
      return;
    }
    this.guestSync = new GuestSync(net.transport, {
      players: this.players,
      localIndex: this.localIndex,
      enemies: this.enemies,
      arrows: this.shots.list,
      effects: this.effects,
      playerTower: this.playerTower,
      enemyTower: this.enemyTower,
      spawnEnemy: (type) => this.spawnEnemy(type),
      launchArrow: (launch) => this.shots.launchReplica(launch),
      playSound: (id, at) => this.playSound(id, at),
      setStatus: (text) => this.ctx.ui.setStatus(text),
      showEnd: (info) => this.showGuestEnd(info),
      restart: (message) => this.restartAsGuest(message),
      backToLobby: () => this.ctx.goTo('coop'),
    }, this.localPlayer.input as RecordingInput);
  }

  /** Guest: the host decides what comes after the level. */
  private showGuestEnd(info: EndInfo): void {
    this.gameEnded = true;
    this.destroyInput();
    this.ctx.ui.showEndScreen({ ...info, buttonLabel: 'Waiting for the host…', onButton: () => {} });
  }

  /** Guest: the host started the next level (or a new battle). */
  private restartAsGuest(message: Extract<NetMessage, { t: 'start' }>): void {
    const { session } = this.ctx;
    session.sandbox = message.sandbox;
    session.run = message.run;
    if (session.net) {
      session.net.wind = message.wind;
    }
    this.ctx.goTo('game');
  }

  public exit(): void {
    super.exit();
    this.destroyInput();
  }

  /**
   * The bowmen: this browser's player first (keyboard and mouse), in co-op a second one in bronze armor whose
   * controls are set from outside (ManualInput; the console for now). A bowman who fell in an earlier level
   * starts lying where he fell.
   */
  private createPlayers(): void {
    const { sandbox, run, playerCount } = this.ctx.session;
    this.players = Array.from({ length: Math.max(1, playerCount) }, (_, index) => {
      const bowman = new Bowman(playerStartX(index), BOWMAN_Y, { x: 0, y: 0, width: WORLD_WIDTH, height: GAME_HEIGHT }, {
        armorColors: index === 0 ? this.battleground.player : secondPlayerArmor(this.battleground.player),
        // Player 1 is the ranger; in co-op player 2 is the keep warden.
        look: index === 0 ? 'ranger' : 'warden',
      });
      bowman.y = groundAt(bowman.x);
      const health = run.bowmanHealths[index] ?? sandbox.bowmanHealth;
      if (health <= 0) {
        bowman.die({}, true);
      }
      this.world.addChild(bowman);
      return { index, bowman, input: new ManualInput() as PlayerInput, local: index === this.localIndex, health, projectile: firstArrow(loadoutOf(this.ctx.session, index)) as ProjectileType };
    });
  }

  private playerOf(bowman: Bowman): Player {
    return this.players.find((player) => player.bowman === bowman) ?? this.localPlayer;
  }

  /** Status line message for one player: shown here if they're this browser's, else sent to the guest. */
  private localStatus(player: Player, message: string): void {
    if (player.local) {
      this.ctx.ui.setStatus(message);
    } else {
      this.hostSync?.push({ e: 'status', player: player.index, text: message });
    }
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
    const input = this.role === 'guest' ? new RecordingInput(this.localInput) : this.localInput;
    this.players[this.localIndex] = { ...this.localPlayer, input };

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
        this.toggleEnemiesVisible();
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
    if (this.players.length > 0) {
      this.players[this.localIndex] = { ...this.localPlayer, input: new ManualInput() };
    }
  }

  /** One player's frame: weapon picks, shots and shrapnel bursts from their controls, then moving the bowman. */
  private updatePlayer(player: Player, deltaMs: number): void {
    const { bowman, input } = player;
    // Only an arrow from that player's own quiver (the guest's picks come over the network).
    const picked = input.takeProjectile();
    const projectile = picked && (loadoutOf(this.ctx.session, player.index) as readonly ProjectileType[]).includes(picked) ? picked : undefined;
    if (projectile) {
      player.projectile = projectile;
      if (player.local) {
        this.ctx.ui.setActiveProjectile(projectile);
        this.ctx.ui.setStatus(PROJECTILE_LABELS[projectile]);
      }
    }
    if (projectile && this.guestSync) {
      this.guestSync.queueProjectile(projectile);
    }
    input.takeShots().forEach((aim) => {
      bowman.setAim(aim.direction, aim.power);
      // Knocked down by a blast (or fallen): the draw is lost.
      if (aim.power > MIN_SHOT_POWER && !bowman.isStunned && !bowman.isDead) {
        if (player.local) {
          this.aimOverlay.recordRelease(aim, bowman.getBowReleasePoint());
        }
        // A co-op guest's shots are loosed by the host (the arrow comes back as an event).
        if (this.guestSync) {
          this.guestSync.queueShot(aim);
        } else {
          this.shots.fire(player, aim, aim.power);
        }
      }
      bowman.setAim(aim.direction, 0);
    });
    if (input.takeBurst()) {
      if (this.guestSync) {
        this.guestSync.queueBurst();
      } else {
        this.shots.burstShrapnel(player);
      }
    }
    this.control.update(player, deltaMs);
  }

  private spawnEnemy(type: EnemyType): Foe {
    const stats = getEnemyStats(type, 1);
    const enemy = isFlyingType(type)
      ? new DragonEnemy(ENEMY_SPAWN_X, stats.health, stats.speed, type)
      : new Enemy(ENEMY_SPAWN_X, stats.health, stats.speed, 'bowman', type);
    enemy.visible = this.enemiesVisible;
    this.enemies.push(enemy);
    this.spawnedEnemies += 1;
    this.world.addChild(enemy);
    this.hostSync?.trackEnemy(enemy, type);
    return enemy;
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

  private toggleEnemiesVisible(): void {
    this.enemiesVisible = !this.enemiesVisible;
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
      enemy.setPaused(!this.enemiesVisible);
    });
    this.debugGraphics.clear();
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
      partnerHealth: this.coop ? this.players[1].health : undefined,
      defeatedEnemies: this.defeatedEnemies(),
      totalEnemies: this.totalEnemies,
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

  private checkEndConditions(): void {
    // A bowman at 0 falls (for the rest of the run); the level is lost once all of them have, or the keep.
    this.players.filter((player) => player.health <= 0 && !player.bowman.isDead).forEach((fallen) => {
      // He falls the way what killed him decides; the guest plays the same fall. Frozen, his ice shatters.
      if (fallen.bowman.isFrozen) {
        this.effects.shatter({ x: fallen.bowman.x, y: fallen.bowman.y - 22 });
      }
      const kind = fallen.bowman.die();
      this.hostSync?.push({ e: 'die', player: fallen.index, kind, fromX: Math.round(fallen.bowman.lastHitFromX ?? fallen.bowman.x) });
      if (this.coop) {
        this.players.forEach((player) => this.localStatus(player, player === fallen ? 'You have fallen · your partner fights on' : 'Your partner has fallen · hold on alone'));
      }
    });
    const bowmen = this.players.map((player) => player.bowman);
    if (livingBowmen(bowmen).length === 0 || this.playerTower.isDestroyed()) {
      this.endGame(false);
      return;
    }
    if (this.enemyTower.isDestroyed()) {
      this.endGame(true);
      return;
    }
    const total = this.totalEnemies;
    if (this.spawnedEnemies >= total && this.defeatedEnemies() >= total) {
      this.endGame(true, true);
    }
  }

  /** Fallen enemies stay in the list (corpses), so every non-living one counts as defeated. */
  private defeatedEnemies(): number {
    return this.enemies.filter((enemy) => !enemy.isAlive()).length;
  }

  /**
   * Ends this level. A cleared level with levels left offers the next one (health carries over);
   * otherwise it's the end of the run: victory (all levels or the enemy keep) or defeat.
   */
  private endGame(won: boolean, levelCleared = false): void {
    this.gameEnded = true;
    this.destroyInput();
    this.director = undefined;
    if (!won) {
      this.enemies.forEach((enemy) => enemy.celebrate());
      this.hostSync?.push({ e: 'cheer' });
    }

    const { session, ui } = this.ctx;
    const { run, sandbox } = session;
    const { info, next } = levelEndInfo({
      won,
      levelCleared,
      levelIndex: run.levelIndex,
      defeated: this.defeatedEnemies(),
      totalEnemies: this.totalEnemies,
      keep: { health: this.playerTower.getHealth(), max: this.playerTower.maxHealth },
      enemyKeepDestroyed: this.enemyTower.isDestroyed(),
      playerKeepDestroyed: this.playerTower.isDestroyed(),
      playerHealths: this.players.map((player) => player.health),
    }, sandbox);
    if (next) {
      this.hostSync?.sendEnd(info);
      ui.showEndScreen({
        ...info,
        buttonLabel: 'Next level',
        onButton: this.endAction = () => {
          session.run = {
            levelIndex: run.levelIndex + 1,
            bowmanHealths: this.players.map((player) => player.health),
            keepHealth: this.playerTower.getHealth(),
            enemyKeepHealth: this.enemyTower.getHealth(),
          };
          this.ctx.goTo('game');
        },
      });
      return;
    }
    this.hostSync?.sendEnd(info);
    ui.showEndScreen({
      ...info,
      buttonLabel: 'Back to sandbox setup',
      onButton: this.endAction = () => {
        // Co-op: the guest goes back to the lobby and waits for the next battle.
        this.ctx.session.net?.transport.send({ t: 'lobby' });
        this.ctx.goTo('sandbox');
      },
    });
  }
}
