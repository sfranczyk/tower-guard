import { Container, Graphics } from 'pixi.js';
import {
  BOWMAN_START_X,
  BOWMAN_Y,
  ENEMY_KEEP_HEALTH,
  ENEMY_TOWER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  PLAYER_TOWER_X,
  SHOW_HITBOX_DEBUG,
  TOWER_ENTRY_ZONE_HEIGHT,
  TOWER_ENTRY_ZONE_WIDTH,
  TOWER_EXIT_X_OFFSET,
  WAVE_SPAWN_INTERVAL_MS,
  WAVE_START_DELAY_MS,
  WORLD_WIDTH,
} from '../config';
import type { SoundId } from '../audio/SoundManager';
import { spatialMix } from '../audio/spatial';
import { Scene, type GameContext } from '../core/Scene';
import { BATTLEGROUNDS, type Battleground } from '../data/battlegrounds';
import { getEnemyStats } from '../data/enemies';
import { launchSpeed } from '../data/projectiles';
import { waveEnemyTotal, waveSpawnOrder, type WaveSetup } from '../data/sandbox';
import InputManager, { type AimInput } from '../managers/InputManager';
import Arrow from '../objects/Arrow';
import Bowman from '../objects/Bowman';
import Enemy from '../objects/Enemy';
import Tower, { TOWER_HEIGHT } from '../objects/Tower';
import { AimOverlay } from '../rendering/AimOverlay';
import { Background } from '../rendering/Background';
import { CombatSystem } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { WaveSpawner } from '../systems/WaveSpawner';
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
};

const PROJECTILE_KEYS: Record<string, ProjectileType> = {
  Digit1: 'normal',
  Digit2: 'explosive',
  Digit3: 'piercing',
};

/**
 * One wave of a sandbox run: the bowman defends the left keep on the wave's battleground. Clearing
 * the wave moves on to the next one (health carries over); destroying the enemy keep wins the run.
 */
export class GameScene extends Scene {
  private readonly wave: WaveSetup;
  private readonly battleground: Battleground;
  private readonly totalEnemies: number;
  private readonly world = new Container();
  private readonly enemies: Enemy[] = [];
  private readonly arrows: Arrow[] = [];
  private readonly debugGraphics = new Graphics();
  private readonly aimOverlay = new AimOverlay();
  private readonly spawner = new WaveSpawner((type) => this.spawnEnemy(type));
  private background!: Background;
  private effects!: EffectsSystem;
  private combat!: CombatSystem;
  /** Storm battlegrounds only: lightning. */
  private weather?: WeatherSystem;
  private playerTower!: Tower;
  private enemyTower!: Tower;
  private bowman!: Bowman;
  private input?: InputManager;

  private cameraX = 0;
  private bowmanHealth: number;
  private spawnedEnemies = 0;
  private selectedProjectile: ProjectileType = 'normal';
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
    this.totalEnemies = waveEnemyTotal(this.wave.enemies);
    this.bowmanHealth = run.bowmanHealth;
  }

  public enter(): void {
    const { ui } = this.ctx;
    ui.showScreen('game');
    ui.setActiveProjectile(this.selectedProjectile);

    this.world.sortableChildren = true;
    this.ctx.root.addChild(this.world);
    this.background = new Background(this.world, this.battleground);
    this.effects = new EffectsSystem(this.world);

    const { textures } = this.ctx;
    const { sandbox, run } = this.ctx.session;
    this.playerTower = new Tower(PLAYER_TOWER_X, GROUND_Y, textures.tower, sandbox.keepHealth, run.keepHealth);
    this.enemyTower = new Tower(ENEMY_TOWER_X, GROUND_Y, textures.towerEnemy, ENEMY_KEEP_HEALTH, run.enemyKeepHealth);
    this.bowman = new Bowman(BOWMAN_START_X, BOWMAN_Y, { x: 50, y: 0, width: WORLD_WIDTH - 100, height: GAME_HEIGHT });
    this.debugGraphics.zIndex = 4;
    this.world.addChild(this.playerTower, this.enemyTower, this.bowman, this.aimOverlay, this.debugGraphics);

    this.combat = new CombatSystem(
      {
        bowman: this.bowman,
        playerTower: this.playerTower,
        enemyTower: this.enemyTower,
        enemies: this.enemies,
        arrows: this.arrows,
        effects: this.effects,
        debug: this.debugGraphics,
      },
      {
        bowmanDamaged: (amount) => {
          this.bowmanHealth = Math.max(0, this.bowmanHealth - amount);
        },
        headshot: () => this.ctx.ui.setStatus(`Headshot! ×${HEADSHOT_DAMAGE_MULTIPLIER} damage`),
        enemyShot: (from, angle, speed) => this.fireEnemyArrow(from, angle, speed),
        sound: (id, at) => this.playSound(id, at),
      },
    );

    ui.setStatus(DEFAULT_STATUS);
    this.syncOptions();
    this.bindInput();
    this.spawner.schedule(waveSpawnOrder(this.wave.enemies), WAVE_SPAWN_INTERVAL_MS, WAVE_START_DELAY_MS);
    if (SHOW_HITBOX_DEBUG) {
      // Debug console hook (?debug): window.__towerGuard.scene gives access to the running wave.
      (window as unknown as { __towerGuard?: unknown }).__towerGuard = { scene: this };
      this.onExit(() => {
        delete (window as unknown as { __towerGuard?: unknown }).__towerGuard;
      });
    }
    this.onExit(() => this.spawner.dispose());
    if (this.battleground.weather === 'storm') {
      this.weather = new WeatherSystem(this.world, this.ctx.root, this.background, {
        // After the wave is decided lightning still flashes but no longer hurts anyone.
        groundStrike: (point) => (this.gameEnded ? this.effects.lightningStrike(point) : this.combat.lightningStrike(point)),
        thunder: (at, close) => {
          const mix = spatialMix(at.x, this.cameraX);
          this.ctx.sound.play('thunder', { ...mix, gain: mix.gain * (close ? 1 : 0.45) });
        },
      });
    }
    const hint = this.battleground.weather === 'storm' ? 'beware of lightning' : 'defend your keep';
    ui.setStatus(`Wave ${run.waveIndex + 1} of ${sandbox.waveCount} · ${this.battleground.name} · ${hint}`);
  }

  /** The world keeps running after the wave ends; the end screen just overlays it. */
  public update(deltaMs: number): void {
    this.background.update(deltaMs);
    this.weather?.update(deltaMs, this.cameraX);
    this.updateBowman(deltaMs);
    this.playerTower.update();
    this.enemyTower.update();

    this.debugGraphics.clear();
    this.effects.update(deltaMs);
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
    });
    this.combat.update(deltaMs, this.enemiesVisible);

    this.updateAim();
    this.updateHud();
    this.updateCamera();
    if (!this.gameEnded) {
      this.checkEndConditions();
    }
  }

  public exit(): void {
    super.exit();
    this.destroyInput();
  }

  private bindInput(): void {
    const { ui, session } = this.ctx;
    this.input = new InputManager({
      eventTarget: this.ctx.app.canvas,
      worldPointFromScreen: (point) => ({ x: point.x + this.cameraX, y: point.y }),
      maxDragDistance: 200,
      screenSize: { x: GAME_WIDTH, y: GAME_HEIGHT },
    });

    this.input.on(InputManager.Events.AIM, (aim: AimInput) => {
      this.bowman.setAim(aim.direction, aim.power);
    });

    this.input.on(InputManager.Events.AIM_RELEASE, (aim: AimInput) => {
      this.bowman.setAim(aim.direction, aim.power);
      if (aim.power > MIN_SHOT_POWER) {
        this.aimOverlay.recordRelease(aim);
        this.fireArrow(aim, aim.power);
      }
      this.bowman.setAim(aim.direction, 0);
    });

    ui.handlers.toggleOptions = () => this.toggleOptions();
    ui.handlers.selectProjectile = (type) => this.selectProjectile(type);
    ui.handlers.trajectoryChange = (enabled) => {
      session.showTrajectory = enabled;
    };
    ui.handlers.audioChange = (changes) => this.ctx.sound.updateSettings(changes);
    this.onExit(() => {
      ui.handlers.toggleOptions = undefined;
      ui.handlers.selectProjectile = undefined;
      ui.handlers.trajectoryChange = undefined;
      ui.handlers.audioChange = undefined;
    });

    this.listenWindow('keydown', (event) => {
      if (event.code === 'Escape') {
        this.ctx.goTo('menu');
        return;
      }
      if (event.code === 'KeyI') {
        this.toggleOptions();
      }
      const projectile = PROJECTILE_KEYS[event.code];
      if (projectile) {
        this.selectProjectile(projectile);
      }
      if (event.code === 'KeyO') {
        this.toggleEnemiesVisible();
      }
      if (this.gameEnded && event.code === 'Space') {
        this.endAction?.();
      }
    });
  }

  private destroyInput(): void {
    this.input?.destroy();
    this.input = undefined;
  }

  private updateBowman(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
    if (this.bowman.isDead) {
      this.bowman.moveHorizontal(0, deltaSeconds);
      if (!this.bowman.isInTower) {
        this.bowman.updateVertical(deltaSeconds);
      }
      this.bowman.updateAnimation(deltaMs, false);
      return;
    }
    const direction = this.input?.getMovementDirection() ?? 0;
    const sprinting = this.input?.isSprintDown() ?? false;
    if (this.input?.isJumpPressed()) {
      this.bowman.jump();
    }

    if (this.bowman.isInTower) {
      if (direction > 0) {
        this.exitTower();
        this.bowman.moveHorizontal(direction, deltaSeconds, sprinting);
      } else {
        this.bowman.moveHorizontal(0, deltaSeconds);
      }
    } else {
      this.bowman.moveHorizontal(direction, deltaSeconds, sprinting);
      this.bowman.updateVertical(deltaSeconds);
      if (direction < 0 && this.canEnterTower()) {
        this.enterTower();
      }
    }

    this.bowman.updateAnimation(deltaMs, direction !== 0, sprinting);
  }

  private canEnterTower(): boolean {
    const left = this.playerTower.x - TOWER_ENTRY_ZONE_WIDTH * 0.65;
    const top = BOWMAN_Y - TOWER_ENTRY_ZONE_HEIGHT * 0.55;
    return this.bowman.x >= left
      && this.bowman.x <= left + TOWER_ENTRY_ZONE_WIDTH
      && this.bowman.y >= top
      && this.bowman.y <= top + TOWER_ENTRY_ZONE_HEIGHT;
  }

  private enterTower(): void {
    this.bowman.enterTower();
    // Feet hidden behind the parapet, head and shoulders above the merlons.
    this.bowman.setTowerPosition(PLAYER_TOWER_X, GROUND_Y - TOWER_HEIGHT + 40);
    this.ctx.ui.setStatus('Hidden in tower · move right to exit');
  }

  private exitTower(): void {
    this.bowman.exitTower();
    this.bowman.setHorizontalPosition(this.playerTower.x + TOWER_EXIT_X_OFFSET);
    this.bowman.y = BOWMAN_Y;
    this.ctx.ui.setStatus(DEFAULT_STATUS);
  }

  private spawnEnemy(type: EnemyType): void {
    if (this.gameEnded) {
      return;
    }
    const stats = getEnemyStats(type, 1);
    const enemy = new Enemy(ENEMY_SPAWN_X, stats.health, stats.speed, 'bowman', type);
    enemy.visible = this.enemiesVisible;
    this.enemies.push(enemy);
    this.spawnedEnemies += 1;
    this.world.addChild(enemy);
  }

  private fireArrow(aim: AimInput, power: number): void {
    this.arrows.forEach((arrow) => arrow.ageTrail());

    const trail = new Graphics();
    trail.zIndex = 1;
    this.world.addChild(trail);

    const releasePoint = this.bowman.getBowReleasePoint();
    const type = this.selectedProjectile;
    const arrow = new Arrow(releasePoint.x, releasePoint.y, this.ctx.textures.arrows[type], trail);
    arrow.fire(Math.atan2(aim.direction.y, aim.direction.x), launchSpeed(type, power), type);
    this.arrows.push(arrow);
    this.world.addChild(arrow);
    this.playSound('bowShot', releasePoint);
  }

  /** An enemy archer's arrow: reddish, hurts the bowman (or the keep while he hides). */
  private fireEnemyArrow(from: Vec2, angle: number, speed: number): void {
    const trail = new Graphics();
    trail.zIndex = 1;
    this.world.addChild(trail);
    const arrow = new Arrow(from.x, from.y, this.ctx.textures.arrows.normal, trail);
    arrow.tint = ENEMY_ARROW_TINT;
    arrow.fire(angle, speed, 'normal', true);
    this.arrows.push(arrow);
    this.world.addChild(arrow);
    this.playSound('bowShot', from);
  }

  /** Panned and faded by where it happens relative to the camera. */
  private playSound(id: SoundId, at: Vec2): void {
    this.ctx.sound.play(id, spatialMix(at.x, this.cameraX));
  }

  private selectProjectile(type: ProjectileType): void {
    this.selectedProjectile = type;
    this.ctx.ui.setActiveProjectile(type);
    this.ctx.ui.setStatus(PROJECTILE_LABELS[type]);
  }

  private toggleOptions(): void {
    this.optionsVisible = !this.optionsVisible;
    this.ctx.ui.setOptionsVisible(this.optionsVisible);
    this.input?.cancelAim();
  }

  private syncOptions(): void {
    this.ctx.ui.setTrajectoryOption(this.ctx.session.showTrajectory);
    this.ctx.ui.setAudioOptions(this.ctx.sound.settings);
  }

  private toggleEnemiesVisible(): void {
    this.enemiesVisible = !this.enemiesVisible;
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
      enemy.setPaused(!this.enemiesVisible);
    });
    this.debugGraphics.clear();
  }

  private updateAim(): void {
    const aim = this.input?.getAim();
    const hasAim = aim !== undefined && aim.power > 0;
    const releasePoint = this.bowman.getBowReleasePoint();
    this.aimOverlay.draw(releasePoint, hasAim ? aim : undefined, hasAim ? this.predictTrajectory(aim, releasePoint) : []);
  }

  /** Path the arrow would take if released now (same integrator, gravity and drag as real arrows). */
  private predictTrajectory(aim: AimInput, releasePoint: Vec2): Vec2[] {
    const power = aim.power;
    if (!this.ctx.session.showTrajectory || power <= MIN_SHOT_POWER) {
      return [];
    }
    const speed = launchSpeed(this.selectedProjectile, power);
    const velocity = { x: aim.direction.x * speed, y: aim.direction.y * speed };
    return simulateTrajectory(releasePoint, velocity, Arrow.getFlightParams(this.selectedProjectile), {
      groundY: GROUND_Y - 3,
      minX: 0,
      maxX: WORLD_WIDTH,
    });
  }

  private updateHud(): void {
    this.ctx.ui.updateHud({
      towerHealth: this.playerTower.getHealth(),
      bowmanHealth: this.bowmanHealth,
      defeatedEnemies: this.defeatedEnemies(),
      totalEnemies: this.totalEnemies,
      wave: this.ctx.session.run.waveIndex + 1,
      waveCount: this.ctx.session.sandbox.waveCount,
      battlegroundName: this.battleground.name,
    });
  }

  private updateCamera(): void {
    const target = clamp(this.bowman.x - GAME_WIDTH / 2, 0, WORLD_WIDTH - GAME_WIDTH);
    this.cameraX += (target - this.cameraX) * CAMERA_SMOOTHING;
    const shake = this.effects.cameraShake;
    this.world.position.set(-this.cameraX + shake.x, shake.y);
  }

  private checkEndConditions(): void {
    if (this.bowmanHealth <= 0 || this.playerTower.isDestroyed()) {
      if (this.bowmanHealth <= 0) {
        this.bowman.die();
      }
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
    this.spawner.dispose();
    if (!won) {
      this.enemies.forEach((enemy) => enemy.celebrate());
    }

    const { session, ui } = this.ctx;
    const { run, sandbox } = session;
    const hasNextWave = won && waveCleared && run.waveIndex + 1 < sandbox.waveCount;
    if (hasNextWave) {
      ui.showEndScreen({
        title: `Wave ${run.waveIndex + 1} cleared!`,
        titleColor: '#82d99a',
        copy: `Next: wave ${run.waveIndex + 2} of ${sandbox.waveCount} at ${BATTLEGROUNDS[sandbox.waves[run.waveIndex + 1].battleground].name}.`,
        buttonLabel: 'Next wave',
        onButton: this.endAction = () => {
          session.run = {
            waveIndex: run.waveIndex + 1,
            bowmanHealth: this.bowmanHealth,
            keepHealth: this.playerTower.getHealth(),
            enemyKeepHealth: this.enemyTower.getHealth(),
          };
          this.ctx.goTo('game');
        },
      });
      return;
    }
    ui.showEndScreen({
      title: won ? 'Victory!' : 'Defeat',
      titleColor: won ? '#82d99a' : '#e66b6b',
      copy: won
        ? (this.enemyTower.isDestroyed() ? 'The enemy keep has fallen.' : `All ${sandbox.waveCount} waves held off.`)
        : `${this.playerTower.isDestroyed() ? 'The keep has fallen' : 'The bowman has fallen'}. Adjust the sandbox and try again.`,
      buttonLabel: 'Back to sandbox setup',
      onButton: this.endAction = () => this.ctx.goTo('sandbox'),
    });
  }
}
