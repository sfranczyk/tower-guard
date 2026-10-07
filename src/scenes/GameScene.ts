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
import { centeredCameraX, viewWidth } from '../core/viewport';
import { BATTLEGROUNDS, aimColorsOf, type Battleground } from '../data/battlegrounds';
import { getEnemyStats } from '../data/enemies';
import { launchSpeed, shrapnelBurst } from '../data/projectiles';
import { waveEnemyTotal, type WaveSetup } from '../data/sandbox';
import InputManager, { type AimInput } from '../managers/InputManager';
import { LocalInput, ManualInput, RecordingInput, type PlayerInput } from '../input/PlayerInput';
import { leaveCoop } from '../net/coopLink';
import { GuestSync } from '../net/GuestSync';
import { HostSync, type ArrowLaunch } from '../net/HostSync';
import type { EndInfo, NetMessage } from '../net/protocol';
import Arrow from '../objects/Arrow';
import Bowman from '../objects/Bowman';
import DragonEnemy from '../objects/DragonEnemy';
import Enemy from '../objects/Enemy';
import Tower from '../objects/Tower';
import { secondPlayerArmor } from '../rendering/armor';
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
import { simulateTrajectory } from '../systems/ballistics';
import type { EnemyType, ProjectileType, Vec2 } from '../types';
import { clamp } from '../utils/math';

const MIN_SHOT_POWER = 0.05;
const CAMERA_SMOOTHING = 0.1;
const DEFAULT_STATUS = 'Drag from the bowman and release to fire';
const ENEMY_ARROW_TINT = 0xff8f80;
/** Enemies walk in from just in front of the enemy keep. */
const ENEMY_SPAWN_X = WORLD_WIDTH - 50;

const PROJECTILE_LABELS: Record<ProjectileType, string> = {
  normal: 'Normal arrow · reliable damage',
  explosive: 'Explosive bolt · heavy, short high arc, area damage on impact',
  piercing: 'Piercing arrow · light and fast, flat and long, passes through enemies',
  shrapnel: 'Shrapnel arrow · press Space in flight to burst it into three small arrows',
  fragment: 'Shrapnel fragment',
};

const PROJECTILE_KEYS: Record<string, ProjectileType> = {
  Digit1: 'normal',
  Digit2: 'explosive',
  Digit3: 'piercing',
  Digit4: 'shrapnel',
};

/** Status text for the wind: arrows for its direction, one to three by strength. */
const windLabel = (wind: number, strongest: number): string => {
  const strength = Math.max(1, Math.min(3, Math.ceil((Math.abs(wind) / Math.max(1, strongest)) * 3)));
  const arrows = (wind < 0 ? '←' : '→').repeat(strength);
  return `wind ${arrows} ${['light', 'moderate', 'strong'][strength - 1]}`;
};

/** Fragments from a shrapnel burst are drawn at this scale (normal arrows: 0.5). */
const FRAGMENT_SCALE = 0.32;

/**
 * One wave of a sandbox run: the bowman defends the left keep on the wave's battleground. Clearing
 * the wave moves on to the next one (health carries over); destroying the enemy keep wins the run.
 */
export class GameScene extends Scene {
  private readonly wave: WaveSetup;
  private readonly battleground: Battleground;
  private readonly totalEnemies: number;
  private readonly world = new Container();
  private readonly enemies: Foe[] = [];
  private readonly arrows: Arrow[] = [];
  private readonly debugGraphics = new Graphics();
  private readonly aimOverlay = new AimOverlay();
  /** Releases the wave's enemies in groups (set up in enter). */
  private director?: WaveDirector;
  private background!: Background;
  private effects!: EffectsSystem;
  private combat!: CombatSystem;
  /** Storm battlegrounds only: lightning. */
  private weather?: WeatherSystem;
  private snow?: Snow;
  /** This wave's wind (px/s² on a normal arrow), rolled from the battleground's strongest wind. */
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

  private cameraX = 0;
  /** The camera starts on its target, then follows it smoothly. */
  private cameraPlaced = false;
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
    this.wave = sandbox.waves[run.waveIndex];
    this.battleground = BATTLEGROUNDS[this.wave.battleground];
    this.role = ctx.session.net?.role ?? 'solo';
    this.localIndex = this.role === 'guest' ? 1 : 0;
    // Windy maps roll a fresh wind for every wave (direction and strength); a co-op guest takes the host's.
    const strongest = this.battleground.wind ?? 0;
    this.wind = this.role === 'guest' ? ctx.session.net!.wind : Math.round((Math.random() * 2 - 1) * strongest);
    this.totalEnemies = waveEnemyTotal(this.wave.enemies);
  }

  /** This browser's player. */
  private get localPlayer(): Player {
    return this.players[this.localIndex];
  }

  private get coop(): boolean {
    return this.players.length > 1;
  }

  public enter(): void {
    const { ui } = this.ctx;
    ui.showScreen('game');
    ui.setActiveProjectile('normal');

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
      enteredTower: (player) => this.localStatus(player, 'Hidden in tower · move right to exit'),
      leftTower: (player) => this.localStatus(player, DEFAULT_STATUS),
    });

    this.combat = new CombatSystem(
      {
        bowmen: this.players.map((player) => player.bowman),
        playerTower: this.playerTower,
        enemyTower: this.enemyTower,
        enemies: this.enemies,
        arrows: this.arrows,
        effects: this.effects,
        debug: this.debugGraphics,
        wind: this.wind,
      },
      {
        bowmanDamaged: (bowman, amount) => {
          const player = this.playerOf(bowman);
          player.health = Math.max(0, player.health - amount);
        },
        headshot: () => this.ctx.ui.setStatus(`Headshot! ×${HEADSHOT_DAMAGE_MULTIPLIER} damage`),
        bowmanIgnited: (bowman) => this.localStatus(this.playerOf(bowman), 'You are on fire! Get out of the flames'),
        enemyShot: (from, angle, speed, shooter) => this.fireEnemyArrow(from, angle, speed, shooter),
        sound: (id, at) => this.playSound(id, at),
      },
    );

    ui.setStatus(DEFAULT_STATUS);
    ui.setTheme(this.battleground.ui);
    this.bindInput();
    // A co-op guest runs no wave of its own: the host's enemies arrive as events.
    if (this.role !== 'guest') {
      this.director = new WaveDirector(this.wave.enemies);
    }
    this.startSync();
    if (SHOW_HITBOX_DEBUG) {
      // Debug console hook (?debug): window.__towerGuard.scene gives access to the running wave.
      (window as unknown as { __towerGuard?: unknown }).__towerGuard = { scene: this };
      this.onExit(() => {
        delete (window as unknown as { __towerGuard?: unknown }).__towerGuard;
      });
    }
    if (this.battleground.weather === 'storm') {
      this.weather = new WeatherSystem(this.world, this.ctx.root, this.background, {
        // After the wave is decided lightning still flashes but no longer hurts anyone.
        // A co-op guest's own bolts are only for show (the host's strikes arrive as effects).
        groundStrike: (point) => (this.gameEnded || this.role === 'guest' ? this.effects.lightningStrike(point) : this.combat.lightningStrike(point)),
        thunder: (at, close) => {
          const mix = spatialMix(at.x, this.cameraX, viewWidth());
          this.ctx.sound.play('thunder', { ...mix, gain: mix.gain * (close ? 1 : 0.45) });
        },
      });
    }
    if (this.battleground.weather === 'snow') {
      this.snow = new Snow(this.ctx.root, this.wind * SNOW_WIND_DRIFT);
    }
    const hint = this.battleground.weather === 'storm' ? 'beware of lightning' : this.wind !== 0 ? windLabel(this.wind, this.battleground.wind ?? 0) : 'defend your keep';
    ui.setStatus(`Wave ${run.waveIndex + 1} of ${sandbox.waveCount} · ${this.battleground.name} · ${hint}`);
  }

  /** The world keeps running after the wave ends; the end screen just overlays it. */
  public update(deltaMs: number): void {
    if (!this.gameEnded && this.director) {
      const alive = this.enemies.filter((enemy) => enemy.isAlive()).length;
      this.director.update(deltaMs, alive).forEach((type) => this.spawnEnemy(type));
    }
    this.background.update(deltaMs);
    this.weather?.update(deltaMs, this.cameraX);
    this.snow?.update(deltaMs, this.cameraX);
    // A co-op guest moves only its own bowman; the host's comes from the host.
    this.players.filter((player) => this.role !== 'guest' || player.local).forEach((player) => this.updatePlayer(player, deltaMs));
    this.playerTower.update(deltaMs);
    this.enemyTower.update(deltaMs);

    this.debugGraphics.clear();
    this.effects.update(deltaMs);
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
    });
    if (this.guestSync) {
      this.guestSync.update(deltaMs);
    } else {
      this.combat.update(deltaMs, this.enemiesVisible);
    }

    this.updateAim();
    this.updateHud();
    this.updateCamera();
    if (!this.gameEnded && this.role !== 'guest') {
      this.checkEndConditions();
    }
    this.hostSync?.update(deltaMs);
    // The guest left mid-wave: player 2 stands still from now on.
    if (this.hostSync && !this.ctx.session.net) {
      this.hostSync = undefined;
      (this.players[1]?.input as ManualInput | undefined)?.set({ direction: 0, sprint: false, aim: undefined });
    }
  }

  /**
   * Co-op online. The host tells the guest the wave's setup and then streams it (HostSync), with the guest's
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
      arrows: this.arrows,
      effects: this.effects,
      playerTower: this.playerTower,
      enemyTower: this.enemyTower,
      spawnEnemy: (type) => this.spawnEnemy(type),
      launchArrow: (launch) => this.launchReplicaArrow(launch),
      playSound: (id, at) => this.playSound(id, at),
      setStatus: (text) => this.ctx.ui.setStatus(text),
      showEnd: (info) => this.showGuestEnd(info),
      restart: (message) => this.restartAsGuest(message),
      backToLobby: () => this.ctx.goTo('coop'),
    }, this.localPlayer.input as RecordingInput);
  }

  /** Guest: an arrow the host launched (its sound comes as its own event). */
  private launchReplicaArrow(launch: ArrowLaunch): Arrow {
    if (launch.hostile) {
      return this.fireEnemyArrow(launch.from, launch.angle, launch.speed, launch.shooter ?? 'archer', true);
    }
    if (launch.type !== 'fragment') {
      this.arrows.filter((arrow) => arrow.owner === launch.owner).forEach((arrow) => arrow.ageTrail(this.ctx.session.arrowTrails));
    }
    return this.launchPlayerArrow(launch.owner, launch.type, launch.from, launch.angle, launch.speed);
  }

  /** Guest: the host decides what comes after the wave. */
  private showGuestEnd(info: EndInfo): void {
    this.gameEnded = true;
    this.destroyInput();
    this.ctx.ui.showEndScreen({ ...info, buttonLabel: 'Waiting for the host…', onButton: () => {} });
  }

  /** Guest: the host started the next wave (or a new battle). */
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
   * controls are set from outside (ManualInput; the console for now). A bowman who fell in an earlier wave
   * starts lying where he fell.
   */
  private createPlayers(): void {
    const { sandbox, run, playerCount } = this.ctx.session;
    this.players = Array.from({ length: Math.max(1, playerCount) }, (_, index) => {
      const bowman = new Bowman(playerStartX(index), BOWMAN_Y, { x: 50, y: 0, width: WORLD_WIDTH - 100, height: GAME_HEIGHT }, {
        armorColors: index === 0 ? this.battleground.player : secondPlayerArmor(this.battleground.player),
      });
      bowman.y = groundAt(bowman.x);
      const health = run.bowmanHealths[index] ?? sandbox.bowmanHealth;
      if (health <= 0) {
        bowman.die(true);
      }
      this.world.addChild(bowman);
      return { index, bowman, input: new ManualInput() as PlayerInput, local: index === this.localIndex, health, projectile: 'normal' as ProjectileType };
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
      worldPointFromScreen: (point) => ({ x: point.x + this.cameraX, y: point.y }),
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
      const projectile = PROJECTILE_KEYS[event.code];
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

  /** Stops reading this browser's keyboard and mouse (the wave ended); the local player stands still. */
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
    const projectile = input.takeProjectile();
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
          this.fireArrow(player, aim, aim.power);
        }
      }
      bowman.setAim(aim.direction, 0);
    });
    if (input.takeBurst()) {
      if (this.guestSync) {
        this.guestSync.queueBurst();
      } else {
        this.burstShrapnel(player);
      }
    }
    this.control.update(player, deltaMs);
  }

  private spawnEnemy(type: EnemyType): Foe {
    const stats = getEnemyStats(type, 1);
    const enemy = type === 'dragon' || type === 'fireDragon'
      ? new DragonEnemy(ENEMY_SPAWN_X, stats.health, stats.speed, type)
      : new Enemy(ENEMY_SPAWN_X, stats.health, stats.speed, 'bowman', type);
    enemy.visible = this.enemiesVisible;
    this.enemies.push(enemy);
    this.spawnedEnemies += 1;
    this.world.addChild(enemy);
    this.hostSync?.trackEnemy(enemy, type);
    return enemy;
  }

  private fireArrow(player: Player, aim: AimInput, power: number): void {
    // Only this player's earlier shots lose their trails.
    this.arrows.filter((arrow) => arrow.owner === player.index).forEach((arrow) => arrow.ageTrail(this.ctx.session.arrowTrails));
    const releasePoint = player.bowman.getBowReleasePoint();
    this.launchPlayerArrow(player.index, player.projectile, releasePoint, Math.atan2(aim.direction.y, aim.direction.x), launchSpeed(player.projectile, power));
    this.playSound('bowShot', releasePoint);
  }

  /** A player arrow (with a trail in the battleground's colours) flying from `from`. */
  private launchPlayerArrow(owner: number, type: ProjectileType, from: Vec2, angle: number, speed: number): Arrow {
    const trail = new Graphics();
    trail.zIndex = 1;
    this.world.addChild(trail);
    const { trailGlow, trailCore } = aimColorsOf(this.battleground);
    const arrow = new Arrow(from.x, from.y, this.ctx.textures.arrows[type], trail, { glow: trailGlow, core: trailCore });
    if (type === 'fragment') {
      arrow.scale.set(FRAGMENT_SCALE);
    }
    arrow.owner = owner;
    arrow.wind = this.wind;
    arrow.fire(angle, speed, type);
    if (this.ctx.session.arrowTrails === 0) {
      arrow.hideTrail();
    }
    this.arrows.push(arrow);
    this.world.addChild(arrow);
    this.hostSync?.trackArrow(arrow, { owner, type, from, angle, speed, hostile: false });
    return arrow;
  }

  /** Space: every shrapnel arrow of this player still in flight bursts into small arrows fanned around its heading. */
  private burstShrapnel(player: Player): void {
    this.arrows
      .filter((arrow) => arrow.isActive && !arrow.isStuck && !arrow.hostile && arrow.type === 'shrapnel' && arrow.owner === player.index)
      .forEach((arrow) => {
        const point = { x: arrow.x, y: arrow.y };
        const fragments = shrapnelBurst(arrow.velocityVector);
        arrow.deactivate();
        fragments.forEach((velocity) => {
          this.launchPlayerArrow(player.index, 'fragment', point, Math.atan2(velocity.y, velocity.x), Math.hypot(velocity.x, velocity.y));
        });
        this.effects.impact(point);
        this.playSound('shrapnelBurst', point);
      });
  }

  /** An enemy archer's arrow: reddish, hurts the bowman (or the keep while he hides); `silent` for a co-op guest's copy. */
  private fireEnemyArrow(from: Vec2, angle: number, speed: number, shooter: EnemyType, silent = false): Arrow {
    const trail = new Graphics();
    trail.zIndex = 1;
    this.world.addChild(trail);
    const arrow = new Arrow(from.x, from.y, this.ctx.textures.arrows.normal, trail);
    arrow.tint = ENEMY_ARROW_TINT;
    arrow.wind = this.wind;
    arrow.fire(angle, speed, 'normal', true);
    arrow.shooter = shooter;
    this.arrows.push(arrow);
    this.world.addChild(arrow);
    this.hostSync?.trackArrow(arrow, { owner: -1, type: 'normal', from, angle, speed, hostile: true, shooter });
    if (!silent) {
      this.playSound('bowShot', from);
    }
    return arrow;
  }

  /** Panned and faded by where it happens relative to the camera (co-op host: the guest hears it too). */
  private playSound(id: SoundId, at: Vec2): void {
    this.ctx.sound.play(id, spatialMix(at.x, this.cameraX, viewWidth()));
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

  /** The local player's aim circles and predicted path. */
  private updateAim(): void {
    const { bowman, input, projectile } = this.localPlayer;
    const aim = input.getAim();
    const hasAim = aim !== undefined && !bowman.isStunned && !bowman.isDead;
    const releasePoint = bowman.getBowReleasePoint();
    this.aimOverlay.draw(releasePoint, hasAim ? aim : undefined, hasAim ? this.predictTrajectory(aim, releasePoint, projectile) : []);
  }

  /** Path the arrow would take if released now (same integrator, gravity and drag as real arrows). */
  private predictTrajectory(aim: AimInput, releasePoint: Vec2, projectile: ProjectileType): Vec2[] {
    const power = aim.power;
    if (!this.ctx.session.showTrajectory || power <= MIN_SHOT_POWER) {
      return [];
    }
    const speed = launchSpeed(projectile, power);
    const velocity = { x: aim.direction.x * speed, y: aim.direction.y * speed };
    return simulateTrajectory(releasePoint, velocity, Arrow.getFlightParams(projectile, this.wind), {
      // Same surface (and offset) at which flying arrows stick into the ground.
      groundY: (x) => groundAt(x) - 3,
      minX: 0,
      maxX: WORLD_WIDTH,
    });
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
      wave: this.ctx.session.run.waveIndex + 1,
      waveCount: this.ctx.session.sandbox.waveCount,
    });
  }

  private updateCamera(): void {
    // Follows the local bowman; a view wider than the world shows all of it, centred, with landscape either side.
    const width = viewWidth();
    const target = width >= WORLD_WIDTH ? centeredCameraX(width) : clamp(this.localPlayer.bowman.x - width / 2, 0, WORLD_WIDTH - width);
    this.cameraX = this.cameraPlaced ? this.cameraX + (target - this.cameraX) * CAMERA_SMOOTHING : target;
    this.cameraPlaced = true;
    const shake = this.effects.cameraShake;
    this.world.position.set(-this.cameraX + shake.x, shake.y);
  }

  private checkEndConditions(): void {
    // A bowman at 0 falls (for the rest of the run); the wave is lost once all of them have, or the keep.
    this.players.filter((player) => player.health <= 0 && !player.bowman.isDead).forEach((fallen) => {
      fallen.bowman.die();
      this.hostSync?.push({ e: 'die', player: fallen.index });
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
   * Ends this wave. A cleared wave with waves left offers the next one (health carries over);
   * otherwise it's the end of the run: victory (all waves or the enemy keep) or defeat.
   */
  private endGame(won: boolean, waveCleared = false): void {
    this.gameEnded = true;
    this.destroyInput();
    this.director = undefined;
    if (!won) {
      this.enemies.forEach((enemy) => enemy.celebrate());
      this.hostSync?.push({ e: 'cheer' });
    }

    const { session, ui } = this.ctx;
    const { run, sandbox } = session;
    const hasNextWave = won && waveCleared && run.waveIndex + 1 < sandbox.waveCount;
    const stats = [
      { label: 'enemies defeated', value: `${this.defeatedEnemies()} / ${this.totalEnemies}` },
      { label: 'keep', value: `${Math.ceil(this.playerTower.getHealth())} / ${this.playerTower.maxHealth}` },
      ...this.players.map((player) => ({
        label: this.coop ? `player ${player.index + 1}` : 'bowman',
        value: `${Math.ceil(player.health)} / ${sandbox.bowmanHealth}`,
      })),
    ];
    if (hasNextWave) {
      const info: EndInfo = {
        title: `Wave ${run.waveIndex + 1} cleared!`,
        outcome: 'win',
        stats,
        copy: `Next: wave ${run.waveIndex + 2} of ${sandbox.waveCount} at ${BATTLEGROUNDS[sandbox.waves[run.waveIndex + 1].battleground].name}.`,
      };
      this.hostSync?.sendEnd(info);
      ui.showEndScreen({
        ...info,
        buttonLabel: 'Next wave',
        onButton: this.endAction = () => {
          session.run = {
            waveIndex: run.waveIndex + 1,
            bowmanHealths: this.players.map((player) => player.health),
            keepHealth: this.playerTower.getHealth(),
            enemyKeepHealth: this.enemyTower.getHealth(),
          };
          this.ctx.goTo('game');
        },
      });
      return;
    }
    const info: EndInfo = {
      title: won ? 'Victory!' : 'Defeat',
      outcome: won ? 'win' : 'loss',
      stats,
      copy: won
        ? (this.enemyTower.isDestroyed() ? 'The enemy keep has fallen.' : sandbox.waveCount === 1 ? 'The wave is held off.' : `All ${sandbox.waveCount} waves held off.`)
        : `${this.playerTower.isDestroyed() ? 'The keep has fallen' : this.coop ? 'Both bowmen have fallen' : 'The bowman has fallen'}. Adjust the sandbox and try again.`,
    };
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
