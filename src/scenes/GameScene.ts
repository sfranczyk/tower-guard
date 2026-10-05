import { Container, Graphics } from 'pixi.js';
import {
  ARROW_BASE_SPEED,
  ARROW_FORCE_SPEED,
  ARROW_SPEED_FACTOR,
  BOWMAN_START_X,
  BOWMAN_Y,
  ENEMY_TOWER_X,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  HEADSHOT_DAMAGE_MULTIPLIER,
  PLAYER_TOWER_X,
  TOWER_ENTRY_ZONE_HEIGHT,
  TOWER_ENTRY_ZONE_WIDTH,
  TOWER_EXIT_X_OFFSET,
  WORLD_WIDTH,
} from '../config';
import { Scene, type GameContext } from '../core/Scene';
import { getEnemyStats } from '../data/enemies';
import InputManager, { type AimInput } from '../managers/InputManager';
import { LEVEL_COUNT, LevelManager, getLevelEnemyTotal } from '../managers/LevelManager';
import Arrow from '../objects/Arrow';
import Bowman from '../objects/Bowman';
import Enemy from '../objects/Enemy';
import Tower, { TOWER_HEIGHT } from '../objects/Tower';
import { AimOverlay } from '../rendering/AimOverlay';
import { Background } from '../rendering/Background';
import { CombatSystem } from '../systems/CombatSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { WaveSpawner } from '../systems/WaveSpawner';
import { simulateTrajectory } from '../systems/ballistics';
import type { ILevelData, IWave, ProjectileType, Vec2 } from '../types';
import { clamp } from '../utils/math';

const BOWMAN_MAX_HEALTH = 100;
const MIN_SHOT_POWER = 0.05;
const CAMERA_SMOOTHING = 0.1;
const DEFAULT_STATUS = 'Drag from the bowman and release to fire';

const PROJECTILE_LABELS: Record<ProjectileType, string> = {
  normal: 'Normal arrow · reliable damage',
  explosive: 'Explosive bolt · area damage on first impact',
  piercing: 'Piercing arrow · passes through enemies',
};

const PROJECTILE_KEYS: Record<string, ProjectileType> = {
  Digit1: 'normal',
  Digit2: 'explosive',
  Digit3: 'piercing',
};

/**
 * One level of the game: the bowman defends the left keep against waves walking in from the
 * enemy keep on the right. Wins when all enemies are defeated or the enemy keep falls.
 */
export class GameScene extends Scene {
  private readonly level: ILevelData;
  private readonly world = new Container();
  private readonly enemies: Enemy[] = [];
  private readonly arrows: Arrow[] = [];
  private readonly debugGraphics = new Graphics();
  private readonly aimOverlay = new AimOverlay();
  private readonly spawner = new WaveSpawner((wave) => this.spawnEnemy(wave));
  private background!: Background;
  private effects!: EffectsSystem;
  private combat!: CombatSystem;
  private playerTower!: Tower;
  private enemyTower!: Tower;
  private bowman!: Bowman;
  private input?: InputManager;

  private cameraX = 0;
  private bowmanHealth = BOWMAN_MAX_HEALTH;
  private spawnedEnemies = 0;
  private defeatedEnemies = 0;
  private selectedProjectile: ProjectileType = 'normal';
  private optionsVisible = false;
  /** Debug toggle (O key): hides and freezes all enemies. */
  private enemiesVisible = true;
  private gameEnded = false;

  public constructor(ctx: GameContext) {
    super(ctx);
    this.level = new LevelManager().loadLevel(this.ctx.session.levelNumber);
  }

  public enter(): void {
    const { ui } = this.ctx;
    ui.showScreen('game');
    ui.setActiveProjectile(this.selectedProjectile);

    this.world.sortableChildren = true;
    this.ctx.root.addChild(this.world);
    this.background = new Background(this.world);
    this.effects = new EffectsSystem(this.world);

    const { textures } = this.ctx;
    this.playerTower = new Tower(PLAYER_TOWER_X, GROUND_Y, textures.tower, this.level.towerHealth);
    this.enemyTower = new Tower(ENEMY_TOWER_X, GROUND_Y, textures.tower, this.level.towerHealth);
    this.enemyTower.tint = 0xb85a4a;
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
        enemyKilled: () => {
          this.defeatedEnemies += 1;
        },
        headshot: () => this.ctx.ui.setStatus(`Headshot! ×${HEADSHOT_DAMAGE_MULTIPLIER} damage`),
      },
    );

    ui.setStatus(DEFAULT_STATUS);
    this.syncOptions();
    this.bindInput();
    this.spawner.schedule(this.level.waves);
    this.onExit(() => this.spawner.dispose());
    ui.setStatus(`Level ${this.level.id}: ${this.level.name} · defend your keep`);
  }

  public update(deltaMs: number): void {
    this.background.update(deltaMs, this.cameraX);
    if (this.gameEnded) {
      return;
    }

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
    this.checkEndConditions();
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
      const effectivePower = aim.power * session.bowTension;
      if (effectivePower > MIN_SHOT_POWER) {
        this.aimOverlay.recordRelease(aim);
        this.fireArrow(aim, effectivePower);
      }
      this.bowman.setAim(aim.direction, 0);
    });

    ui.handlers.toggleOptions = () => this.toggleOptions();
    ui.handlers.selectProjectile = (type) => this.selectProjectile(type);
    ui.handlers.gravityChange = (value) => {
      Arrow.setGravity(value);
      this.syncOptions();
    };
    ui.handlers.tensionChange = (value) => {
      session.bowTension = value;
      this.syncOptions();
    };
    ui.handlers.trajectoryChange = (enabled) => {
      session.showTrajectory = enabled;
    };
    this.onExit(() => {
      ui.handlers.toggleOptions = undefined;
      ui.handlers.selectProjectile = undefined;
      ui.handlers.gravityChange = undefined;
      ui.handlers.tensionChange = undefined;
      ui.handlers.trajectoryChange = undefined;
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
        this.ctx.goTo('menu');
      }
    });
  }

  private destroyInput(): void {
    this.input?.destroy();
    this.input = undefined;
  }

  private updateBowman(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;
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
    this.bowman.setTowerPosition(PLAYER_TOWER_X, GROUND_Y - TOWER_HEIGHT + 48);
    this.ctx.ui.setStatus('Hidden in tower · move right to exit');
  }

  private exitTower(): void {
    this.bowman.exitTower();
    this.bowman.setHorizontalPosition(this.playerTower.x + TOWER_EXIT_X_OFFSET);
    this.bowman.y = BOWMAN_Y;
    this.ctx.ui.setStatus(DEFAULT_STATUS);
  }

  private spawnEnemy(wave: IWave): void {
    if (this.gameEnded) {
      return;
    }
    const stats = getEnemyStats(wave.enemyType, this.level.enemyDifficulty);
    const enemy = new Enemy(wave.spawn.spawnPoint.x, stats.health, stats.speed, 'bowman');
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
    const arrow = new Arrow(releasePoint.x, releasePoint.y, this.ctx.textures.arrow, trail);
    arrow.fire(Math.atan2(aim.direction.y, aim.direction.x), GameScene.launchSpeed(power), this.selectedProjectile);
    this.arrows.push(arrow);
    this.world.addChild(arrow);
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
    this.ctx.ui.setOptionValues(Arrow.getGravity(), this.ctx.session.bowTension, this.ctx.session.showTrajectory);
  }

  private toggleEnemiesVisible(): void {
    this.enemiesVisible = !this.enemiesVisible;
    this.enemies.forEach((enemy) => {
      enemy.visible = this.enemiesVisible;
      enemy.setPaused(!this.enemiesVisible);
    });
    this.debugGraphics.clear();
  }

  private static launchSpeed(power: number): number {
    return (ARROW_BASE_SPEED + power * ARROW_FORCE_SPEED) * ARROW_SPEED_FACTOR;
  }

  private updateAim(): void {
    const aim = this.input?.getAim();
    const hasAim = aim !== undefined && aim.power > 0;
    this.ctx.ui.setAimPower(hasAim ? aim.strength.value : 0);
    const releasePoint = this.bowman.getBowReleasePoint();
    this.aimOverlay.draw(releasePoint, hasAim ? aim : undefined, hasAim ? this.predictTrajectory(aim, releasePoint) : []);
  }

  /** Path the arrow would take if released now (same integrator, gravity and drag as real arrows). */
  private predictTrajectory(aim: AimInput, releasePoint: Vec2): Vec2[] {
    const power = aim.power * this.ctx.session.bowTension;
    if (!this.ctx.session.showTrajectory || power <= MIN_SHOT_POWER) {
      return [];
    }
    const speed = GameScene.launchSpeed(power);
    const velocity = { x: aim.direction.x * speed, y: aim.direction.y * speed };
    return simulateTrajectory(releasePoint, velocity, Arrow.getFlightParams(), {
      groundY: GROUND_Y - 3,
      minX: 0,
      maxX: WORLD_WIDTH,
    });
  }

  private updateHud(): void {
    this.ctx.ui.updateHud({
      towerHealth: this.playerTower.getHealth(),
      bowmanHealth: this.bowmanHealth,
      defeatedEnemies: this.defeatedEnemies,
      totalEnemies: getLevelEnemyTotal(this.level),
      level: this.ctx.session.levelNumber,
      levelName: this.level.name,
      gold: this.ctx.session.gold,
    });
  }

  private updateCamera(): void {
    const target = clamp(this.bowman.x - GAME_WIDTH / 2, 0, WORLD_WIDTH - GAME_WIDTH);
    this.cameraX += (target - this.cameraX) * CAMERA_SMOOTHING;
    this.world.x = -this.cameraX;
  }

  private checkEndConditions(): void {
    if (this.bowmanHealth <= 0 || this.playerTower.isDestroyed()) {
      this.endGame(false);
      return;
    }
    if (this.enemyTower.isDestroyed()) {
      this.endGame(true);
      return;
    }
    const total = getLevelEnemyTotal(this.level);
    const aliveEnemies = this.enemies.filter((enemy) => enemy.isAlive()).length;
    if (this.spawnedEnemies >= total && aliveEnemies === 0 && this.defeatedEnemies >= total) {
      this.endGame(true);
    }
  }

  private endGame(won: boolean): void {
    this.gameEnded = true;
    this.destroyInput();

    const { session, ui } = this.ctx;
    const hasNextLevel = won && session.levelNumber < LEVEL_COUNT;
    ui.showEndScreen({
      title: won ? (hasNextLevel ? `Level ${session.levelNumber} cleared!` : 'Kingdom saved') : 'Defeat',
      titleColor: won ? '#82d99a' : '#e66b6b',
      copy: won
        ? `Reward: +${this.level.goldReward} gold. ${hasNextLevel ? 'Prepare for the next battle.' : 'The realm is safe.'}`
        : 'The keep has fallen. Return to the main menu and try again.',
      buttonLabel: hasNextLevel ? 'Continue to next level' : 'Return to menu',
      onButton: () => {
        if (hasNextLevel) {
          session.gold += this.level.goldReward;
          session.levelNumber += 1;
          this.ctx.goTo('game');
        } else {
          this.ctx.goTo('menu');
        }
      },
    });
  }
}
