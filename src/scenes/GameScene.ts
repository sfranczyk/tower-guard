import { Container, Graphics } from 'pixi.js';
import {
  GROUND_Y,
  MIN_SHOT_POWER,
  PLAYER_TOWER_X,
  SHOW_HITBOX_DEBUG,
  SURVIVAL_WORLD_WIDTH,
  WORLD_WIDTH,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import { spatialMix } from '../audio/spatial';
import { Scene, isMultiplayer, type GameContext } from '../core/Scene';
import { viewWidth } from '../core/viewport';
import { BATTLEGROUNDS, aimColorsOf, type Battleground } from '../data/battlegrounds';
import { enemyEdge, enemyKeepHealth, wavePacing } from '../data/difficulty';
import { bannersInPlay, friendlyFireOn, runBattleground, runLevelCount, survivalLevel, type SurvivalLevel } from '../data/sandbox';
import { enterBattle, loadoutOf } from '../net/coopLink';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import Tower from '../objects/Tower';
import { BattleNetReadout } from './BattleNetReadout';
import { BattleArrows } from './BattleArrows';
import { BattleCamera } from './BattleCamera';
import { BattleAllies } from './BattleAllies';
import { BattleBanners } from './BattleBanners';
import { BattleControls } from './BattleControls';
import { BattleEnemies } from './BattleEnemies';
import { BattleOutcome } from './BattleOutcome';
import { BattleSurvival } from './BattleSurvival';
import { BattleRelief } from './BattleRelief';
import { BattlePlayers } from './BattlePlayers';
import { startBattleSync } from './battleSync';
import { DEFAULT_STATUS, clockText, windLabel } from './battleText';
import { weatherArrowNote } from '../systems/weatherArrows';
import { rollWind, WindShifts } from '../systems/windShift';
import { PlayerControl, canDrawBow, type Player } from './PlayerControl';
import { AimOverlay } from '../rendering/AimOverlay';
import { Background } from '../rendering/Background';
import { CombatSystem, type Foe } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { DamageNumbers } from '../objects/DamageNumbers';
import { BattleWeather } from './BattleWeather';
import { battleCombatEvents } from './battleCombatEvents';
import { firstArrow, type Loadout } from '../data/loadout';
import type Enemy from '../objects/enemy/Enemy';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import { ALLY_ORDER_LABELS } from '../systems/allyOrders';
import type { Vec2 } from '../types';
import { enemyKeepX, useBattlefield, worldWidth } from '../systems/battlefield';

/**
 * One level of a sandbox run: the bowman defends the left keep on the level's battleground. Clearing
 * the level moves on to the next one (health carries over); destroying the enemy keep wins the run.
 */
export class GameScene extends Scene {
  private readonly battleground: Battleground;
  /** Survival runs: the level's kinds and time; its clock and night once entered (`survival`; ?debug: `scene.survival.skip(ms)`). */
  private readonly survivalSetup?: SurvivalLevel;
  private survival?: BattleSurvival;
  /** Survival: the relief force marching in once the level is held (BattleRelief). */
  private relief?: BattleRelief;
  private readonly world = new Container();
  /** The level's enemies (also `foes.list`; kept here for the ?debug console: `scene.enemies[0]`). */
  private readonly enemies: Foe[] = [];
  private readonly foes: BattleEnemies;
  /** The player's soldiers (also `soldiers.list`; for the ?debug console: `scene.allies[0]`). */
  private readonly allies: Enemy[] = [];
  private readonly soldiers: BattleAllies;
  /** The run's Banners option (solo only; scenes/BattleBanners.ts). */
  private banners?: BattleBanners;
  /** Every arrow of the level. */
  private readonly shots: BattleArrows;
  private readonly debugGraphics = new Graphics();
  private readonly aimOverlay = new AimOverlay();
  private background!: Background;
  private effects!: EffectsSystem;
  private damageNumbers!: DamageNumbers;
  private combat!: CombatSystem;
  /** Storm battlegrounds only: lightning. */
  private weather?: BattleWeather;
  /** The wind now (px/s² on a normal arrow), rolled from the battleground's strongest; it may change mid-level. */
  private wind: number;
  private readonly windShifts: WindShifts;
  private playerTower!: Tower;
  private enemyTower!: Tower;
  /** One per player (co-op: two; the host is player 1, the guest player 2). */
  private team!: BattlePlayers;
  private control!: PlayerControl;
  /** The local player's keyboard, mouse, pause and soldier commands (scenes/BattleControls.ts). */
  private controls?: BattleControls;
  private outcome!: BattleOutcome;
  /** Co-op online: this browser's role, and the sync with the other browser. */
  private readonly role: 'solo' | 'host' | 'guest';
  private readonly localIndex: number;
  private hostSync?: HostSync;
  private guestSync?: GuestSync;
  /** Co-op with ?debug: ping, jitter and traffic in a corner. */
  private netReadout?: BattleNetReadout;

  private readonly camera = new BattleCamera();
  /** Where the local player's drawn shot would land (x), while aiming. */
  private aimLandingX?: number;

  public constructor(ctx: GameContext) {
    super(ctx);
    const { sandbox, run } = ctx.session;
    this.survivalSetup = survivalLevel(sandbox, run.levelIndex);
    // Before anything is laid out on it: a survival level's field is shorter (host and guest build the same).
    useBattlefield(this.survivalSetup ? SURVIVAL_WORLD_WIDTH : WORLD_WIDTH);
    // No view wider than the field: a big window letterboxes instead of showing ground nobody can play on.
    ctx.ui.limitViewWidth(worldWidth());
    this.battleground = BATTLEGROUNDS[runBattleground(sandbox, run.levelIndex)];
    this.role = ctx.session.net?.role ?? 'solo';
    this.localIndex = ctx.session.net?.localIndex ?? 0;
    enterBattle(ctx.session);
    // Windy maps roll a fresh wind for every level (direction and strength); a co-op guest takes the host's.
    const strongest = this.battleground.wind ?? 0;
    this.wind = this.role === 'guest' ? ctx.session.net!.wind : rollWind(strongest);
    this.windShifts = new WindShifts(this.role === 'guest' ? 0 : strongest);
    // Part of the battle setup (in co-op the host's sandbox), so it holds for the whole run.
    const { difficulty } = sandbox;
    const survival = this.survivalSetup;
    this.foes = new BattleEnemies(survival
      ? { survival: { kinds: survival.kinds, durationMs: survival.minutes * 60_000, levelIndex: run.levelIndex, difficulty } }
      : { counts: sandbox.levels[run.levelIndex].enemies }, {
      world: this.world,
      list: this.enemies,
      guest: this.role === 'guest',
      wavePacing: wavePacing(difficulty),
      hostSync: () => this.hostSync,
      onDamaged: (foe, amount, hit) => this.damageNumbers.show(foe, amount, hit),
    });
    this.soldiers = new BattleAllies({
      world: this.world,
      list: this.allies,
      onDamaged: (ally, amount, hit) => this.damageNumbers.show(ally, amount, hit),
    });
    this.shots = new BattleArrows({
      world: this.world,
      textures: ctx.textures,
      battleground: this.battleground,
      wind: () => this.wind,
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
    this.damageNumbers = new DamageNumbers(this.world, () => this.ctx.session.showDamageNumbers);
    this.aimOverlay.setColors(aimColorsOf(this.battleground));

    const { sandbox, run } = this.ctx.session;
    const hillColor = this.battleground.hills[0];
    // Co-op: the keep gets a second, lower tower for the second bowman.
    const towers = this.ctx.session.playerCount;
    this.playerTower = new Tower(PLAYER_TOWER_X, GROUND_Y, { hillColor, enemy: false, towers }, sandbox.keepHealth, run.keepHealth);
    // Survival: the enemy has no keep (they come from beyond the field).
    this.enemyTower = new Tower(enemyKeepX(), GROUND_Y, { hillColor, enemy: true, absent: !!this.survivalSetup }, enemyKeepHealth(sandbox.difficulty, sandbox.keepHealth), run.enemyKeepHealth);
    if (this.survivalSetup) {
      this.survival = new BattleSurvival(this.survivalSetup, this.background);
      this.relief = new BattleRelief(this.world);
    }
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

    // Banners: solo only (the guest doesn't see the soldiers yet, net/CLAUDE.md).
    if (bannersInPlay(sandbox, this.ctx.session.net !== undefined)) {
      this.banners = new BattleBanners({
        world: this.world,
        units: () => [...this.allies, ...this.enemies.filter((foe): foe is Enemy => !(foe instanceof DragonEnemy))],
        view: () => ({ left: this.camera.x, width: viewWidth() }),
        markers: () => this.ctx.session.bannerMarkers,
        status: (text) => this.ctx.ui.setStatus(text),
        wind: () => this.wind,
      });
    }
    // The drawer's banner markers option only in a battle with banners.
    this.ctx.ui.settings.showBannerMarkersOption(this.banners !== undefined);
    this.onExit(() => this.ctx.ui.settings.showBannerMarkersOption(false));
    this.combat = new CombatSystem(
      {
        bowmen: this.team.bowmen,
        playerTower: this.playerTower,
        enemyTower: this.enemyTower,
        enemies: this.enemies,
        allies: this.allies,
        allyOrder: () => this.soldiers.order,
        arrows: this.shots.list,
        effects: this.effects,
        debug: this.debugGraphics,
        wind: () => this.wind,
        weather: this.battleground.weather,
        friendlyFire: () => friendlyFireOn(this.ctx.session.sandbox, isMultiplayer(this.ctx.session)),
        reinforcementsDue: () => this.foes.reinforcementsDue,
        enemyEdge: enemyEdge(this.ctx.session.sandbox.difficulty),
        banners: this.banners?.field,
      },
      battleCombatEvents({ ctx: this.ctx, team: this.team, shots: this.shots, playSound: (id, at) => this.playSound(id, at) }),
    );

    this.outcome = new BattleOutcome({
      ctx: this.ctx,
      team: this.team,
      foes: this.foes,
      enemies: this.enemies,
      soldiers: this.soldiers,
      playerTower: this.playerTower,
      enemyTower: this.enemyTower,
      banners: this.banners,
      survival: this.survival,
      relief: this.relief,
      hostSync: () => this.hostSync,
      stopInput: () => this.controls?.destroy(),
    });

    ui.setStatus(DEFAULT_STATUS);
    ui.setTheme(this.battleground.ui);
    this.controls = new BattleControls({
      ctx: this.ctx,
      role: this.role,
      localIndex: this.localIndex,
      team: this.team,
      soldiers: this.soldiers,
      foes: this.foes,
      cameraX: () => this.camera.x,
      hostSync: () => this.hostSync,
      guestSync: () => this.guestSync,
      ended: () => this.outcome.ended,
      endAction: () => this.outcome.endAction,
      won: () => this.outcome.won,
      enemyKeepHealth: () => this.enemyTower.getHealth(),
      foesToggled: () => this.debugGraphics.clear(),
      onKeyDown: (handler) => this.listenWindow('keydown', handler),
      onExit: (dispose) => this.onExit(dispose),
    });
    const controls = this.controls;
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
      showGuestEnd: (info) => this.outcome.showGuestEnd(info),
      guestPaused: (paused) => controls.setPaused(paused, !controls.pauseAsked),
      windChanged: (wind) => this.setWind(wind),
      survivalClock: this.survival && (() => this.survival!.remainingMs),
      setSurvivalClock: (ms) => this.survival?.sync(ms),
    }));
    if (this.hostSync) {
      this.hostSync.onPauseRequest = (paused, from) => controls.pauseFor(from, paused);
    }
    if (SHOW_HITBOX_DEBUG && (this.hostSync || this.guestSync)) {
      const readout = new BattleNetReadout(this.ctx, this.hostSync, this.guestSync);
      this.netReadout = readout;
      this.onExit(() => readout.close());
    }
    if (SHOW_HITBOX_DEBUG) {
      // Debug console hook (?debug): window.__towerGuard.scene gives access to the running level.
      (window as unknown as { __towerGuard?: unknown }).__towerGuard = { scene: this };
      this.onExit(() => {
        delete (window as unknown as { __towerGuard?: unknown }).__towerGuard;
      });
    }
    this.weather = new BattleWeather(this.battleground, this.world, this.ctx.root, this.background, this.wind, {
      // After the level is decided lightning still flashes but no longer hurts anyone.
      // A co-op guest's own bolts are only for show (the host's strikes arrive as effects).
      groundStrike: (point) => (this.outcome.ended || this.role === 'guest' ? this.effects.lightningStrike(point) : this.combat.lightningStrike(point)),
      thunder: (at, close) => {
        const mix = spatialMix(at.x, this.camera.x, viewWidth());
        this.ctx.sound.play('thunder', { ...mix, gain: mix.gain * (close ? 1 : 0.45) });
      },
    });
    const hint = this.battleground.weather === 'storm' ? 'beware of lightning' : this.wind !== 0 ? windLabel(this.wind, this.battleground.wind ?? 0)
      : this.survival ? `hold out for ${clockText(this.survival.durationMs)}` : 'defend your keep';
    const note = weatherArrowNote(this.battleground.weather);
    ui.setStatus(`Level ${run.levelIndex + 1} of ${runLevelCount(sandbox)} · ${this.battleground.name} · ${hint}${note ? ` · ${note}` : ''}`);
  }

  /** The world keeps running after the level ends; the end screen just overlays it. */
  public update(deltaMs: number): void {
    this.controls?.releaseLeftGuests();
    if (this.controls?.paused) {
      return;
    }
    this.foes.update(deltaMs);
    this.soldiers.update(deltaMs);
    const shifted = this.windShifts.update(deltaMs, this.wind);
    if (shifted !== undefined) {
      this.setWind(shifted);
      this.hostSync?.push({ e: 'wind', wind: shifted });
    }
    this.background.update(deltaMs);
    this.survival?.update(deltaMs, this.camera.x, !this.outcome.ended, this.role === 'guest');
    // The host (or solo) calls the relief when the level is held (BattleOutcome); a guest when the host's clock runs out.
    if (this.role === 'guest' && this.survival?.timeUp && !this.outcome.ended) {
      this.relief?.arrive();
    }
    this.relief?.update(deltaMs);
    this.weather?.update(deltaMs, this.camera.x);
    // A co-op guest moves only its own bowman; the host's comes from the host.
    this.players.filter((player) => this.role !== 'guest' || player.local).forEach((player) => this.team.update(player, deltaMs));
    this.playerTower.update(deltaMs);
    this.enemyTower.update(deltaMs);

    this.debugGraphics.clear();
    this.effects.update(deltaMs);
    this.damageNumbers.update(deltaMs);
    this.shots.update(deltaMs);
    if (this.guestSync) {
      this.guestSync.update(deltaMs);
    } else {
      this.combat.update(deltaMs, this.foes.visible);
      this.banners?.update(deltaMs);
    }

    this.shots.prune();
    this.updateAim();
    this.updateHud();
    this.updateCamera(deltaMs);
    if (!this.outcome.ended && this.role !== 'guest') {
      this.outcome.check();
    }
    this.hostSync?.update(deltaMs);
    this.netReadout?.update(deltaMs);
  }

  /** The wind changed mid-level: arrows loosed from now on, the aim's path and the snow follow it. */
  private setWind(wind: number): void {
    this.wind = wind;
    this.weather?.setWind(wind);
    this.ctx.ui.setStatus(`The wind shifts · ${windLabel(wind, this.battleground.wind ?? 0)}`);
  }

  public exit(): void {
    super.exit();
    this.controls?.destroy();
    useBattlefield();
    this.ctx.ui.limitViewWidth();
  }

  /** Panned and faded by where it happens relative to the camera (co-op host: the guest hears it too). */
  private playSound(id: SoundId, at: Vec2): void {
    this.ctx.sound.play(id, spatialMix(at.x, this.camera.x, viewWidth()));
    this.hostSync?.sound(id, at);
  }

  /**
   * The local player's aim circles and predicted path (when the preview is on), and where the drawn shot would
   * land (the camera slides towards it).
   */
  private updateAim(): void {
    const { bowman, input, projectile } = this.localPlayer;
    const aim = input.getAim();
    const hasAim = aim !== undefined && !bowman.isStunned && !bowman.isDead;
    // The chosen arrow still loading: grey circles, no path.
    const loaded = canDrawBow(this.localPlayer);
    const releasePoint = bowman.getBowReleasePoint();
    const path = hasAim && loaded && aim.power > MIN_SHOT_POWER ? this.shots.simulate(aim, releasePoint, projectile) : [];
    this.aimLandingX = path.length > 0 ? path[path.length - 1].x : undefined;
    this.aimOverlay.draw(releasePoint, hasAim ? aim : undefined, this.ctx.session.showTrajectory ? path : [], this.ctx.session.showCursorCircle, !loaded);
  }

  private updateHud(): void {
    this.players.forEach((player) => player.bowman.setHealthRatio(player.health / this.ctx.session.sandbox.bowmanHealth));
    this.ctx.ui.updateAllies({ slots: this.soldiers.slots(), order: this.soldiers.order, orderLabel: ALLY_ORDER_LABELS[this.soldiers.order] });
    this.ctx.ui.updateHud({
      defeatedEnemies: this.foes.defeated(),
      totalEnemies: this.foes.total,
      level: this.ctx.session.run.levelIndex + 1,
      levelCount: runLevelCount(this.ctx.session.sandbox),
      clockMs: this.survival?.remainingMs,
    });
    this.ctx.ui.updateBanners(this.banners && this.ctx.session.bannerMarkers
      ? { player: this.banners.state('player'), enemy: this.banners.state('enemy') }
      : undefined);
  }

  /** The camera follows the local bowman and slides towards where he's aiming (BattleCamera); after a lost level the keys may move it freely. */
  private updateCamera(deltaMs: number): void {
    const pan = this.controls?.panInput;
    if (pan) {
      const position = this.camera.pan(deltaMs, pan.getMovementDirection(), pan.isSprintDown(), this.effects.cameraShake);
      this.world.position.set(position.x, position.y);
      return;
    }
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
}
