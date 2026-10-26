import { Container, Graphics } from 'pixi.js';
import { SHOW_HITBOX_DEBUG } from '../config';
import type { SoundId } from '../audio/SoundManager';
import { spatialMix } from '../audio/spatial';
import { soundFor } from '../audio/soundCatalog';
import { Scene, type GameContext } from '../core/Scene';
import { clearShownRange, setShownRange, viewWidth } from '../core/viewport';
import { aimColorsOf, type Battleground } from '../data/battlegrounds';
import { wavePacing } from '../data/difficulty';
import { bannersInPlay, runLevelCount, survivalLevel, type SurvivalLevel } from '../data/sandbox';
import { enterBattle, loadoutOf } from '../net/coopLink';
import type { GuestSync } from '../net/GuestSync';
import type { HostSync } from '../net/HostSync';
import Tower from '../objects/Tower';
import { BattleNetReadout } from './BattleNetReadout';
import { BattleArrows } from './BattleArrows';
import { BattleStatsWatch } from './BattleStatsWatch';
import { BattleCamera } from './BattleCamera';
import { BattleHud } from './BattleHud';
import { BattleView } from './BattleView';
import { BattleAllies } from './BattleAllies';
import { BattleBanners } from './BattleBanners';
import { matchTeams, type Team } from '../data/moba';
import { MobaMode } from './MobaMode';
import { BattleControls } from './BattleControls';
import { BattleNameTags } from './BattleNameTags';
import { BattleEnemies } from './BattleEnemies';
import { BattleOutcome } from './BattleOutcome';
import { BattleSurvival } from './BattleSurvival';
import { BattleRelief } from './BattleRelief';
import { BattlePlayers } from './BattlePlayers';
import { startBattleSync } from './battleSync';
import { DEFAULT_STATUS, levelStartStatus, windLabel } from './battleText';
import { rollWind, WindShifts } from '../systems/windShift';
import { PlayerControl, type Player } from './PlayerControl';
import { AimOverlay } from '../rendering/AimOverlay';
import { Background } from '../rendering/Background';
import { setBarsMirrored } from '../rendering/healthBar';
import { CombatSystem, type Foe } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { DamageNumbers } from '../objects/DamageNumbers';
import { BattleWeather } from './BattleWeather';
import { BattleLeftovers } from './BattleLeftovers';
import { createBattleCombat } from './battleCombat';
import { createKeeps, prepareField } from './battleKeeps';
import { firstArrow } from '../data/loadout';
import type Enemy from '../objects/enemy/Enemy';
import DragonEnemy from '../objects/dragon/DragonEnemy';
import type { EnemyType, Vec2 } from '../types';
import { useBattlefield } from '../systems/battlefield';

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
  /** MOBA (`?moba`): the lanes, the match and the shop (scenes/MobaMode.ts). */
  private readonly moba?: MobaMode;
  /** Each player's team (MOBA; all blue otherwise). */
  private readonly teams: readonly Team[];
  /** The run's Banners option (solo only; scenes/BattleBanners.ts). */
  private banners?: BattleBanners;
  /** Every arrow of the level. */
  private readonly shots: BattleArrows;
  /** Over the world: the weather that flies across the view (mirrored with it). */
  private screenLayer!: Container;
  /** Corpses and stuck arrows cleared away after a while (config LEFTOVERS). */
  private readonly leftovers: BattleLeftovers;
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
  /** Ctrl held: the players' names over the bowmen. */
  private nameTags?: BattleNameTags;
  private outcome!: BattleOutcome;
  /** Co-op online: this browser's role, and the sync with the other browser. */
  private readonly role: 'solo' | 'host' | 'guest';
  private readonly localIndex: number;
  private hostSync?: HostSync;
  private guestSync?: GuestSync;
  /** What the level's end screen reports (host or solo; scenes/BattleStatsWatch.ts). */
  private stats?: BattleStatsWatch;
  /** Co-op with ?debug: ping, jitter and traffic in a corner. */
  private netReadout?: BattleNetReadout;

  private readonly camera = new BattleCamera();
  /** The local player's aim, camera and mirrored world (scenes/BattleView.ts). */
  private readonly view: BattleView;
  private readonly hud: BattleHud;

  public constructor(ctx: GameContext) {
    super(ctx);
    const { sandbox, run } = ctx.session;
    // MOBA is fought on a battle map, whatever the setup's mode.
    this.survivalSetup = ctx.session.moba ? undefined : survivalLevel(sandbox, run.levelIndex);
    this.battleground = prepareField(ctx, this.survivalSetup !== undefined);
    this.role = ctx.session.net?.role ?? 'solo';
    // MOBA online: the teams picked in the lobby (the host's; a guest gets them with `start`).
    const lobbyTeams = ctx.session.net?.role === 'host' ? ctx.session.net.teams : ctx.session.teams;
    this.teams = matchTeams(ctx.session.playerCount, !!ctx.session.moba, lobbyTeams);
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
      ? { survival: { kinds: survival.kinds, durationMs: survival.minutes * 60_000, levelIndex: run.levelIndex, difficulty, players: this.ctx.session.playerCount } }
      : ctx.session.moba ? { lanes: true } : { counts: sandbox.levels[run.levelIndex].enemies }, {
      world: this.world,
      list: this.enemies,
      guest: this.role === 'guest',
      wavePacing: wavePacing(difficulty),
      hostSync: () => this.hostSync,
      onDamaged: (foe, amount, hit) => {
        this.damageNumbers.show(foe, amount, hit);
        this.stats?.foeHurt(foe, 'red', amount, hit);
      },
    });
    this.soldiers = new BattleAllies({
      world: this.world,
      list: this.allies,
      onDamaged: (ally, amount, hit) => {
        this.damageNumbers.show(ally, amount, hit);
        this.stats?.foeHurt(ally, 'blue', amount, hit);
      },
    });
    if (ctx.session.moba) {
      this.moba = new MobaMode({
        ctx, world: this.world, soldiers: this.soldiers, foes: this.foes, teams: this.teams,
        popups: () => this.damageNumbers, hostSync: () => this.hostSync, guestSync: () => this.guestSync,
        background: () => this.background, arrows: () => this.shots.list, viewLeft: () => this.camera.x, mirrored: () => this.mirrored,
      });
    }
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
      arrowPower: (owner, type) => this.moba?.arrowPower(owner, type),
      keepPower: (owner, type) => this.moba?.keepPower(owner, type),
      // MOBA: the other team's shots fly without a trail to read their aim by.
      showsTrail: (owner) => !this.moba || this.players.find((player) => player.index === owner)?.team === this.team.local.team,
      fired: (owner, type) => this.stats?.shot(owner, type),
    });
    this.leftovers = new BattleLeftovers({
      pools: () => [
        { list: this.enemies, cleared: () => this.foes.corpseCleared() },
        { list: this.soldiers.list },
        ...(this.moba ? [{ list: this.moba.allyFliers }] : []),
      ],
      arrows: () => this.shots.list,
    });
    this.view = new BattleView({
      session: ctx.session, camera: this.camera, world: this.world, screenLayer: () => this.screenLayer, localPlayer: () => this.localPlayer,
      shots: this.shots, aimOverlay: this.aimOverlay, cameraShake: () => this.effects.cameraShake, panInput: () => this.controls?.panInput,
      redrawHealthBars: () => this.redrawHealthBars(),
    });
    this.hud = new BattleHud({
      ctx, team: () => this.team, foes: this.foes, soldiers: this.soldiers, moba: this.moba, survival: () => this.survival,
      banners: () => this.banners, localKeep: () => this.localKeep, damageNumbers: () => this.damageNumbers,
      nameTags: () => this.nameTags, mirrored: () => this.mirrored,
    });
  }

  private get players(): Player[] {
    return this.team.list;
  }

  /** This browser's player. */
  private get localPlayer(): Player {
    return this.team.local;
  }

  /** This browser's player's keep (MOBA red: the right one). */
  private get localKeep(): Tower {
    return this.localPlayer.team === 'red' ? this.enemyTower : this.playerTower;
  }

  public enter(): void {
    const { ui } = this.ctx;
    ui.showScreen('game');
    // Each player fights with their own quiver (co-op: picked by each; alone: the battle setup's).
    const loadout = loadoutOf(this.ctx.session, this.localIndex);
    ui.setLoadout(loadout);
    ui.setActiveProjectile(firstArrow(loadout));

    this.world.sortableChildren = true;
    this.ctx.root.addChild(this.world);
    this.background = new Background(this.world, this.battleground, undefined, { dayCycle: this.moba !== undefined });
    this.effects = new EffectsSystem(this.world);
    this.damageNumbers = new DamageNumbers(this.world, () => this.ctx.session.showDamageNumbers, () => this.mirrored);
    this.aimOverlay.setColors(aimColorsOf(this.battleground));

    const { sandbox, run } = this.ctx.session;
    ({ playerTower: this.playerTower, enemyTower: this.enemyTower } = createKeeps(this.ctx.session, this.battleground, this.teams, !!this.survivalSetup));
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
      teams: this.teams,
      shots: this.shots,
      aimOverlay: this.aimOverlay,
      control: () => this.control,
      effects: () => this.effects,
      hostSync: () => this.hostSync,
      guestSync: () => this.guestSync,
    });
    const keepOf = (player: Player): Tower => (player.team === 'red' ? this.enemyTower : this.playerTower);
    this.moba?.start(this.team, keepOf, this.role === 'guest', [this.playerTower, this.enemyTower]);
    this.onExit(() => this.moba?.destroy());
    // The end screen's report: counted on the host or alone (a co-op guest gets it with the end).
    if (this.role !== 'guest') {
      this.stats = new BattleStatsWatch({
        session: this.ctx.session,
        players: this.players,
        sides: { red: () => this.enemies, blue: () => [...this.allies, ...(this.moba?.allyFliers ?? [])] },
        playerTower: this.playerTower,
        enemyTower: this.survivalSetup ? undefined : this.enemyTower,
        moba: this.moba !== undefined,
        economy: () => this.moba?.match?.economy,
        wavesStarted: () => this.foes.wavesStarted,
        levelMs: this.survivalSetup && this.survivalSetup.minutes * 60_000,
      });
    }
    this.control = new PlayerControl(keepOf, {
      enteredTower: (player) => this.team.status(player, 'Hidden in tower · press S to exit'),
      leftTower: (player) => this.team.status(player, DEFAULT_STATUS),
    });

    // Banners: solo only (the guest doesn't see the soldiers yet, net/CLAUDE.md).
    if (!this.moba && bannersInPlay(sandbox, this.ctx.session.net !== undefined)) {
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
    this.combat = createBattleCombat({
      ctx: this.ctx, team: this.team, playerTower: this.playerTower, enemyTower: this.enemyTower, enemies: this.enemies, allies: this.allies,
      foes: this.foes, soldiers: this.soldiers, shots: this.shots, effects: this.effects, debug: this.debugGraphics, battleground: this.battleground,
      wind: () => this.wind, banners: this.banners, moba: this.moba, stats: this.stats, playSound: (id, at) => this.playSound(id, at),
    });

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
      moba: this.moba?.match,
      allyFliers: this.moba?.allyFliers,
      hostSync: () => this.hostSync,
      stats: this.stats,
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
      cameraX: () => this.camera.x,
      mirrored: () => this.mirrored,
      hostSync: () => this.hostSync,
      guestSync: () => this.guestSync,
      ended: () => this.outcome.ended,
      endAction: () => this.outcome.endAction,
      won: () => this.outcome.won,
      enemyKeepHealth: () => this.enemyTower.getHealth(),
      onKeyDown: (handler) => this.listenWindow('keydown', handler),
      shop: this.moba?.shop,
      moba: this.moba !== undefined,
      onExit: (dispose) => this.onExit(dispose),
    });
    this.nameTags = new BattleNameTags(this.ctx.session, (type, handler) => this.listenWindow(type, handler));
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
      spawnEnemy: (type, place, minion) => (minion && this.moba ? this.moba.lanes.spawn(type, minion) : this.foes.spawn(type as EnemyType, place)),
      moba: this.moba,
      playSound: (id, at) => this.playSound(id, at),
      showGuestEnd: (info) => this.outcome.showGuestEnd(info),
      guestPaused: (paused) => controls.setPaused(paused, !controls.pauseAsked),
      windChanged: (wind) => this.setWind(wind),
      survivalClock: this.survival && (() => this.survival!.remainingMs),
      setSurvivalClock: (ms) => this.survival?.sync(ms),
    }));
    if (this.hostSync) {
      this.moba?.listen(this.hostSync);
      this.hostSync.onPauseRequest = (paused, from) => controls.pauseFor(from, paused);
    }
    if (SHOW_HITBOX_DEBUG && (this.hostSync || this.guestSync)) {
      const readout = new BattleNetReadout(this.ctx, this.hostSync, this.guestSync);
      this.netReadout = readout;
      this.onExit(() => readout.close());
    }
    if (SHOW_HITBOX_DEBUG) {
      this.exposeForDebug();
    }
    // Rain, snow and sand fly over the view in their own layer, mirrored with the world.
    this.screenLayer = new Container();
    this.ctx.root.addChild(this.screenLayer);
    this.weather = new BattleWeather(this.battleground, this.world, this.screenLayer, this.background, this.wind, {
      // After the level is decided lightning still flashes but no longer hurts anyone.
      // A co-op guest's own bolts are only for show (the host's strikes arrive as effects).
      groundStrike: (point) => (this.outcome.ended || this.role === 'guest' ? this.effects.lightningStrike(point) : this.combat.lightningStrike(point)),
      thunder: (at, close) => {
        const mix = spatialMix(this.view.heardX(at.x), this.camera.x, viewWidth());
        this.ctx.sound.play('thunder', { ...mix, gain: mix.gain * (close ? 1 : 0.45) });
      },
    });
    ui.setStatus(levelStartStatus({
      levelIndex: run.levelIndex, levelCount: runLevelCount(sandbox), battleground: this.battleground, wind: this.wind,
      survivalMs: this.survival?.durationMs, mobaGoal: this.moba?.goal(this.localPlayer.team),
    }));
  }

  /** The world keeps running after the level ends; the end screen just overlays it. */
  public update(deltaMs: number): void {
    this.controls?.releaseLeftGuests();
    if (this.controls?.frozen) {
      return;
    }
    // Last frame's view: bodies far off it skip drawing (isShownX).
    setShownRange(this.camera.x, this.camera.x + viewWidth());
    this.foes.update(deltaMs);
    this.soldiers.update(deltaMs);
    this.moba?.update(deltaMs, !this.outcome.ended);
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
    this.leftovers.update(deltaMs);
    if (this.guestSync) {
      this.guestSync.update(deltaMs);
    } else {
      this.combat.update(deltaMs);
      this.banners?.update(deltaMs);
      this.moba?.sky?.strikeComet(deltaMs);
      this.stats?.update(deltaMs);
    }

    this.shots.prune();
    this.view.updateAim();
    this.hud.update();
    this.view.updateCamera(deltaMs);
    if (!this.outcome.ended && this.role !== 'guest') {
      this.outcome.check();
    }
    this.outcome.tick(deltaMs);
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
    setBarsMirrored(false);
    clearShownRange();
    useBattlefield();
    this.ctx.ui.limitViewWidth();
  }

  /** The battle view is mirrored for this player (settings window: his keep on the other side of the screen). */
  private get mirrored(): boolean {
    return this.view.mirrored;
  }

  /** The view was just mirrored or unmirrored: the bars drawn so far fill from the other end now (bowmen redraw theirs every frame). */
  private redrawHealthBars(): void {
    [...this.enemies, ...this.allies, ...(this.moba?.allyFliers ?? [])].forEach((foe) => foe.drawHealthBar());
    this.playerTower.drawHealthBar();
    this.enemyTower.drawHealthBar();
  }

  /** Panned and faded by where it happens relative to the camera (co-op host: the guest hears it too). `heardBy`: a
   * sound for that player alone (the others get `soundFor`'s stand-in, here and on the guests). */
  private playSound(id: SoundId, at: Vec2, heardBy?: number): void {
    this.ctx.sound.play(soundFor(id, heardBy, this.localIndex), spatialMix(this.view.heardX(at.x), this.camera.x, viewWidth()));
    this.hostSync?.sound(id, at, heardBy);
  }

}
